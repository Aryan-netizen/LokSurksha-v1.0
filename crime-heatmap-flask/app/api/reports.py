import os
import hashlib
import math
import re
from difflib import SequenceMatcher
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import requests
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import Comment, CrimeReport, ReportConfirmation, ReportTag, ReportVerification, SubmissionAudit
from app.services.area_service import build_area_name_map, area_key_from_coords, set_area_name
from app.services.otp_service import consume_verified_token
from app.services.tag_service import normalize_hashtags, suggest_hashtags
from app.services.geocode_service import geocode_location, reverse_geocode_location
from app.services.fir_verify_service import verify_fir_payload
from app.services.nlp_service import normalize_report_text
from app.services.socket_service import (
    build_area_stats,
    build_heatmap_payload,
    emit_new_report_updates,
    enrich_report_with_meta,
)

reports_bp = Blueprint("reports", __name__)


def _to_utc(value) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _compact_trend_areas(areas: list[dict], max_areas: int = 220) -> list[dict]:
    if len(areas) <= max_areas:
        return areas
    ranked = sorted(
        areas,
        key=lambda area: (area.get("score", 0), area.get("count", 0), area.get("intensity", 0)),
        reverse=True,
    )
    return ranked[:max_areas]


def _build_heatmap_trend_frames(reports: list[CrimeReport], days: int, cumulative: bool) -> dict:
    now = datetime.now(timezone.utc)
    start_day = (now - timedelta(days=max(days - 1, 0))).date()
    day_window = [start_day + timedelta(days=offset) for offset in range(days)]
    normalized = [
        {
            "report": report,
            "created_at": _to_utc(report.created_at),
        }
        for report in reports
    ]

    frames = []
    for day in day_window:
        if cumulative:
            scoped_reports = [item["report"] for item in normalized if item["created_at"].date() <= day]
        else:
            scoped_reports = [item["report"] for item in normalized if item["created_at"].date() == day]

        area_stats = build_area_stats(scoped_reports)
        payload = build_heatmap_payload(area_stats)
        compact_areas = _compact_trend_areas(payload["areas"])
        hotspots = sorted(
            compact_areas,
            key=lambda area: (area.get("intensity", 0), area.get("score", 0), area.get("count", 0)),
            reverse=True,
        )[:6]
        frames.append(
            {
                "date": day.isoformat(),
                "total_reports": len(scoped_reports),
                "max_count": payload["max_count"],
                "max_score": payload["max_score"],
                "areas": compact_areas,
                "hotspots": hotspots,
            }
        )

    return {
        "mode": "cumulative" if cumulative else "daily",
        "days": days,
        "frames": frames,
    }


def _allowed_file(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


def _serialize_comment(comment: Comment) -> dict:
    return {
        "id": comment.id,
        "report_id": comment.report_id,
        "parent_id": comment.parent_id,
        "author_name": comment.author_name,
        "content": comment.content,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "replies": [],
    }


def _report_comment_counts() -> dict[int, int]:
    rows = (
        db.session.query(Comment.report_id, func.count(Comment.id))
        .group_by(Comment.report_id)
        .all()
    )
    return {report_id: count for report_id, count in rows}


def _report_confirmation_counts() -> dict[int, int]:
    rows = (
        db.session.query(ReportConfirmation.report_id, func.count(ReportConfirmation.id))
        .group_by(ReportConfirmation.report_id)
        .all()
    )
    return {report_id: count for report_id, count in rows}


def _report_verified_map() -> dict[int, dict]:
    rows = ReportVerification.query.all()
    return {
        row.report_id: {
            "otp_verified": bool(row.otp_verified),
            "fir_verified": bool(row.fir_verified),
            "fir_score": int(row.fir_score or 0),
        }
        for row in rows
    }


def _client_fingerprint() -> str:
    explicit = (request.headers.get("X-Client-Id") or "").strip()
    if explicit:
        return explicit[:120]
    ip = (request.remote_addr or "").strip()
    ua = (request.user_agent.string or "").strip()
    raw = f"{ip}|{ua}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(1e-9, 1 - a)))
    return radius * c


def _build_location_bucket(lat: float, lng: float) -> str:
    return f"{round(lat, 3)},{round(lng, 3)}"


def _description_hash(description: str, normalized_description: str = "") -> str:
    base = normalized_description or " ".join((description or "").strip().lower().split())
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _token_set(text: str) -> set[str]:
    return {tok for tok in (text or "").split() if tok}


def _semantic_similarity(left_text: str, right_text: str) -> float:
    left_tokens = _token_set(left_text)
    right_tokens = _token_set(right_text)
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens.intersection(right_tokens)) / max(1, len(left_tokens.union(right_tokens)))
    sequence = SequenceMatcher(a=left_text, b=right_text).ratio()
    return round((0.62 * overlap) + (0.38 * sequence), 4)


def _spam_signal_score(description: str, normalized_description: str = "") -> tuple[int, list[str]]:
    text = (description or "").strip()
    lowered = (normalized_description or text.lower()).strip()
    score = 0
    reasons: list[str] = []

    if not text:
        return 100, ["empty_description"]

    if re.search(r"(https?://|www\.)", lowered):
        score += 25
        reasons.append("contains_link")
    if re.search(r"(.)\1{6,}", text):
        score += 20
        reasons.append("repeated_characters")
    if len(text) <= 8:
        score += 18
        reasons.append("too_short")
    alpha_chars = [ch for ch in text if ch.isalpha()]
    if alpha_chars:
        upper_ratio = sum(1 for ch in alpha_chars if ch.isupper()) / len(alpha_chars)
        if upper_ratio > 0.8 and len(alpha_chars) > 12:
            score += 14
            reasons.append("excessive_caps")
    if re.search(r"\b(test|asdf|qwerty|dummy|spam)\b", lowered):
        score += 18
        reasons.append("test_spam_keywords")

    return min(score, 100), reasons


def _check_anti_spam(
    client_fp: str,
    description: str,
    lat: float,
    lng: float,
    normalized_description: str = "",
) -> tuple[bool, str, int, list[str]]:
    now = datetime.now(timezone.utc)
    desc_hash = _description_hash(description, normalized_description=normalized_description)
    location_bucket = _build_location_bucket(lat, lng)
    suspicious_score, reasons = _spam_signal_score(description, normalized_description=normalized_description)

    # Simple bot honeypot trap.
    honeypot = (request.values.get("website") or "").strip()
    if honeypot:
        suspicious_score = min(100, suspicious_score + 80)
        reasons.append("honeypot_triggered")

    # Optional client timing check (frontend can pass form_started_at timestamp).
    form_started_at = (request.values.get("form_started_at") or "").strip()
    if form_started_at:
        try:
            started = datetime.fromtimestamp(float(form_started_at), tz=timezone.utc)
            if (now - started).total_seconds() < 3:
                suspicious_score = min(100, suspicious_score + 25)
                reasons.append("submitted_too_fast")
        except Exception:
            pass

    rate_limit_count = int(current_app.config.get("REPORT_RATE_LIMIT_COUNT", 5))
    rate_window_seconds = int(current_app.config.get("REPORT_RATE_LIMIT_WINDOW_SECONDS", 300))
    recent_window = now - timedelta(seconds=rate_window_seconds)
    recent_count = (
        SubmissionAudit.query.filter(
            SubmissionAudit.client_fingerprint == client_fp,
            SubmissionAudit.created_at >= recent_window,
        ).count()
    )
    if recent_count >= rate_limit_count:
        reasons.append("rate_limited")
        return False, "Too many reports in short time. Please wait and try again.", suspicious_score, reasons

    dup_window_seconds = int(current_app.config.get("DUPLICATE_REPORT_WINDOW_SECONDS", 900))
    duplicate_since = now - timedelta(seconds=dup_window_seconds)
    recent_reports = (
        CrimeReport.query.filter(CrimeReport.created_at >= duplicate_since)
        .order_by(CrimeReport.created_at.desc())
        .limit(80)
        .all()
    )
    for report in recent_reports:
        dist = _distance_km(lat, lng, report.location_lat, report.location_lng)
        report_nlp = normalize_report_text(report.description)
        existing_hash = _description_hash(report.description, normalized_description=report_nlp["normalized_text"])
        similarity = _semantic_similarity(normalized_description, report_nlp["normalized_text"])
        if dist <= 0.4 and existing_hash == desc_hash:
            reasons.append("duplicate_report")
            return False, "Duplicate report detected for same location and description.", suspicious_score, reasons
        if dist <= 0.6 and similarity >= 0.78:
            reasons.append("semantic_duplicate_report")
            return (
                False,
                "Very similar report already exists nearby. Please confirm existing report instead of reposting.",
                suspicious_score,
                reasons,
            )

    should_block_suspicious = bool(current_app.config.get("BLOCK_SUSPICIOUS_REPORTS", True))
    suspicious_threshold = int(current_app.config.get("SUSPICIOUS_SCORE_BLOCK_THRESHOLD", 65))
    if should_block_suspicious and suspicious_score >= suspicious_threshold:
        reasons.append("suspicious_pattern_block")
        return False, "Report blocked by anti-spam filters. Please provide clear factual details.", suspicious_score, reasons

    return True, "", suspicious_score, reasons


def _interpolate_route_points(start: tuple[float, float], end: tuple[float, float], steps: int = 18) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for i in range(steps + 1):
        t = i / steps
        lat = start[0] + (end[0] - start[0]) * t
        lng = start[1] + (end[1] - start[1]) * t
        points.append((lat, lng))
    return points


def _offset_route_points(start: tuple[float, float], end: tuple[float, float], direction: int = 1) -> list[tuple[float, float]]:
    mid_lat = (start[0] + end[0]) / 2
    mid_lng = (start[1] + end[1]) / 2
    d_lat = end[0] - start[0]
    d_lng = end[1] - start[1]
    norm = math.sqrt(d_lat * d_lat + d_lng * d_lng) or 1.0
    # Perpendicular offset for alternative paths.
    p_lat = -d_lng / norm
    p_lng = d_lat / norm
    scale = 0.025 * direction
    waypoint = (mid_lat + p_lat * scale, mid_lng + p_lng * scale)
    first_leg = _interpolate_route_points(start, waypoint, steps=10)
    second_leg = _interpolate_route_points(waypoint, end, steps=10)
    return first_leg[:-1] + second_leg


def _fetch_osrm_routes(start: tuple[float, float], end: tuple[float, float], max_routes: int = 3) -> list[dict]:
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{start[1]},{start[0]};{end[1]},{end[0]}"
    )
    response = requests.get(
        url,
        params={
            "alternatives": "true",
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
            "annotations": "false",
        },
        timeout=12,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"osrm route provider error ({response.status_code})")
    payload = response.json()
    routes = payload.get("routes") or []
    formatted = []
    for idx, route in enumerate(routes[:max_routes]):
        geometry = route.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        if len(coords) < 2:
            continue
        formatted.append(
            {
                "id": f"road_{idx}",
                "label": "Fastest Road Route" if idx == 0 else f"Road Alternative {idx}",
                "distance_km": round(float(route.get("distance", 0.0)) / 1000.0, 3),
                "duration_min": round(float(route.get("duration", 0.0)) / 60.0, 1),
                "polyline": [{"lat": round(c[1], 6), "lng": round(c[0], 6)} for c in coords],
            }
        )
    return formatted


def _route_risk_score(route_points: list[tuple[float, float]], hotspots: list[dict]) -> tuple[float, list[dict]]:
    band_weight = {"low": 1.0, "medium": 1.8, "high": 3.0, "critical": 4.5}
    exposure = 0.0
    touched: dict[str, dict] = {}
    for lat, lng in route_points:
        for hotspot in hotspots:
            dist = _distance_km(lat, lng, hotspot["location_lat"], hotspot["location_lng"])
            if dist > 2.2:
                continue
            weight = band_weight.get((hotspot.get("risk_band") or "low").lower(), 1.0)
            proximity = math.exp(-(dist / 0.7) ** 2)
            risk_index = float(hotspot.get("risk_index") or 0.0)
            contribution = weight * (0.6 + risk_index) * proximity
            exposure += contribution
            key = hotspot.get("area_key") or f"{hotspot.get('location_lat')},{hotspot.get('location_lng')}"
            item = touched.get(key)
            if item is None or contribution > item["peak"]:
                touched[key] = {
                    "area_key": hotspot.get("area_key"),
                    "area_name": hotspot.get("area_name"),
                    "risk_band": hotspot.get("risk_band"),
                    "distance_km": round(dist, 3),
                    "location_lat": hotspot.get("location_lat"),
                    "location_lng": hotspot.get("location_lng"),
                    "peak": contribution,
                }
    touched_list = sorted(touched.values(), key=lambda item: item["peak"], reverse=True)[:6]
    return exposure, touched_list


@reports_bp.post("/reports/suggestions")
def get_report_suggestions():
    data = request.get_json(silent=True) or request.form
    description = (data.get("description") or "").strip()
    nlp = normalize_report_text(description)
    normalized = nlp.get("normalized_text", "")
    area_name = (data.get("area_name") or "").strip()
    crime_level = (data.get("crime_level") or "low").strip().lower()
    return jsonify(
        {
            "hashtags": suggest_hashtags(
                description=normalized or description,
                area_name=area_name,
                crime_level=crime_level,
            ),
            "ai": {
                "summary": nlp.get("summary", ""),
                "category": nlp.get("category", "general"),
                "category_confidence": nlp.get("category_confidence", 0.0),
                "urgency_hint": nlp.get("urgency_hint", "low"),
                "keywords": nlp.get("keywords", []),
            },
        }
    ), 200


@reports_bp.post("/reports/location/search")
def search_location():
    data = request.get_json(silent=True) or request.form
    query = (data.get("query") or "").strip()
    if len(query) < 3:
        return jsonify({"error": "Location query must be at least 3 characters"}), 400
    try:
        result = geocode_location(query)
    except Exception as exc:
        return jsonify({"error": f"Location search failed: {exc}"}), 502
    if not result:
        return jsonify({"error": "No matching location found"}), 404
    return jsonify(result), 200


@reports_bp.post("/reports/location/reverse")
def reverse_location():
    data = request.get_json(silent=True) or request.form
    lat = data.get("location_lat")
    lng = data.get("location_lng")
    if lat is None or lng is None:
        return jsonify({"error": "location_lat and location_lng are required"}), 400
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return jsonify({"error": "location_lat and location_lng must be valid numbers"}), 400
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({"error": "location_lat or location_lng out of valid range"}), 400
    try:
        result = reverse_geocode_location(lat, lng)
    except Exception as exc:
        return jsonify({"error": f"Location reverse lookup failed: {exc}"}), 502
    if not result:
        return jsonify({"error": "No matching area found"}), 404
    return jsonify(result), 200


@reports_bp.post("/reports")
def create_report():
    data = request.get_json(silent=True) or request.form
    client_fp = _client_fingerprint()
    description = (data.get("description") or "").strip()
    nlp = normalize_report_text(description)
    normalized_description = nlp["normalized_text"]
    lat = data.get("location_lat")
    lng = data.get("location_lng")
    crime_level = (data.get("crime_level") or "low").strip().lower()
    area_name = (data.get("area_name") or "").strip()
    hashtags = normalize_hashtags(data.get("hashtags"))
    phone = (data.get("phone") or "").strip()
    otp_token = (data.get("otp_token") or "").strip()
    fir_state = (data.get("fir_state") or "").strip()
    fir_police_station = (data.get("fir_police_station") or "").strip()
    fir_number = (data.get("fir_number") or "").strip()
    fir_date = (data.get("fir_date") or "").strip()
    fir_ipc_sections = (data.get("fir_ipc_sections") or "").strip()

    if not description or lat is None or lng is None:
        return jsonify({"error": "description, location_lat, and location_lng are required"}), 400

    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return jsonify({"error": "location_lat and location_lng must be valid numbers"}), 400
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({"error": "location_lat or location_lng out of valid range"}), 400

    allowed, reason, suspicious_score, spam_reasons = _check_anti_spam(
        client_fp,
        description,
        lat,
        lng,
        normalized_description=normalized_description,
    )
    audit_row = SubmissionAudit(
        client_fingerprint=client_fp,
        description_hash=_description_hash(description, normalized_description=normalized_description),
        location_bucket=_build_location_bucket(lat, lng),
        was_blocked=not allowed,
        block_reason=",".join(spam_reasons)[:120] if spam_reasons else None,
        suspicious_score=int(suspicious_score),
    )
    db.session.add(audit_row)
    db.session.commit()
    if not allowed:
        return jsonify({"error": reason, "anti_spam": {"score": suspicious_score, "flags": spam_reasons}}), 429

    image_url = None
    photo = request.files.get("photo")
    fir_file = request.files.get("fir_file")
    if photo and photo.filename:
        if not _allowed_file(photo.filename):
            return jsonify({"error": "unsupported file type"}), 400
        filename = secure_filename(photo.filename)
        upload_dir = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        photo.save(file_path)
        image_url = f"{current_app.config['UPLOAD_URL_PREFIX']}/{filename}"

    if current_app.config.get("REQUIRE_FIR_FOR_REPORTS", True):
        if not fir_state or not fir_police_station or not fir_number or not fir_date:
            return jsonify(
                {
                    "error": "FIR verification is required: provide state, police station, FIR number and FIR date",
                }
            ), 400

        if current_app.config.get("REQUIRE_FIR_DOCUMENT", False):
            if not fir_file or not fir_file.filename:
                return jsonify({"error": "FIR document upload is required"}), 400

        fir_bytes = None
        fir_filename = ""
        if fir_file and fir_file.filename:
            fir_filename = fir_file.filename
            fir_bytes = fir_file.read()

        fir_result = verify_fir_payload(
            state=fir_state,
            police_station=fir_police_station,
            fir_number=fir_number,
            fir_date=fir_date,
            ipc_sections=fir_ipc_sections,
            filename=fir_filename,
            file_bytes=fir_bytes,
        )
        min_score = int(current_app.config.get("MIN_FIR_VERIFY_SCORE", 75))
        provider_unavailable = (fir_result.get("provider_mode") or "").strip().lower() == "live_unavailable"
        local_checks_ok = all(
            bool(check.get("passed"))
            for check in (fir_result.get("checks") or [])
            if (check.get("name") or "").strip().lower() != "hyperverge lookup"
        )
        failed_verification = fir_result["score"] < min_score or fir_result["status"] == "not_verified"
        should_block = failed_verification and (not provider_unavailable or not local_checks_ok)
        if should_block:
            return jsonify(
                {
                    "error": "FIR verification failed. Report blocked to reduce false reports.",
                    "fir_verification": fir_result,
                }
            ), 400

    if current_app.config.get("REQUIRE_REPORT_OTP", True):
        if not phone or not otp_token:
            return jsonify({"error": "phone and otp_token are required"}), 400
        ok, error_message = consume_verified_token(otp_token, phone)
        if not ok:
            return jsonify({"error": error_message}), 400

    report = CrimeReport(
        description=description,
        location_lat=lat,
        location_lng=lng,
        crime_level=crime_level,
        image_url=image_url,
    )
    db.session.add(report)
    db.session.commit()

    verification = ReportVerification(
        report_id=report.id,
        otp_verified=bool(current_app.config.get("REQUIRE_REPORT_OTP", True)),
        fir_verified=bool(
            isinstance(locals().get("fir_result"), dict)
            and (fir_result.get("status") or "").strip().lower() == "verified_likely"
        ),
        fir_score=int(fir_result["score"]) if "fir_result" in locals() and isinstance(fir_result, dict) else 0,
    )
    db.session.add(verification)
    db.session.commit()

    if not hashtags:
        hashtags = suggest_hashtags(description=normalized_description or description, area_name=area_name, crime_level=crime_level)
    for tag in hashtags:
        db.session.add(ReportTag(report_id=report.id, tag=tag))
    db.session.commit()
    if area_name:
        set_area_name(lat, lng, area_name)
    payload = emit_new_report_updates(report)
    return jsonify(payload), 201


@reports_bp.get("/reports")
def get_reports():
    client_fp = _client_fingerprint()
    reports = CrimeReport.query.order_by(CrimeReport.created_at.desc()).all()
    area_stats = build_area_stats(reports)
    area_name_map = build_area_name_map([area_key_from_coords(lat, lng) for lat, lng in area_stats.keys()])
    comment_counts = _report_comment_counts()
    confirmation_counts = _report_confirmation_counts()
    verification_map = _report_verified_map()
    confirmed_report_ids = {
        row.report_id
        for row in ReportConfirmation.query.filter_by(client_fingerprint=client_fp).all()
    }
    payload = [
        enrich_report_with_meta(
            report,
            area_stats,
            area_name_map=area_name_map,
            confirmation_counts=confirmation_counts,
            verification_map=verification_map,
            comment_counts=comment_counts,
            confirmed_report_ids=confirmed_report_ids,
        )
        for report in reports
    ]
    return jsonify(payload), 200


@reports_bp.get("/reports/heatmap")
def get_heatmap_data():
    reports = CrimeReport.query.all()
    area_stats = build_area_stats(reports)
    return jsonify(build_heatmap_payload(area_stats)), 200


@reports_bp.get("/reports/heatmap/trend")
def get_heatmap_trend():
    days_raw = request.args.get("days", "14")
    mode = (request.args.get("mode") or "cumulative").strip().lower()
    try:
        days = int(days_raw)
    except ValueError:
        days = 14
    days = max(7, min(90, days))
    cumulative = mode != "daily"

    reports = CrimeReport.query.order_by(CrimeReport.created_at.asc()).all()
    return jsonify(_build_heatmap_trend_frames(reports, days=days, cumulative=cumulative)), 200


@reports_bp.get("/reports/route/safety")
def get_route_safety():
    origin_query = (request.args.get("origin") or "").strip()
    destination_query = (request.args.get("destination") or "").strip()
    if len(origin_query) < 3 or len(destination_query) < 3:
        return jsonify({"error": "origin and destination are required"}), 400

    try:
        origin = geocode_location(origin_query)
        destination = geocode_location(destination_query)
    except Exception as exc:
        return jsonify({"error": f"Route lookup failed: {exc}"}), 502
    if not origin or not destination:
        return jsonify({"error": "Could not resolve origin or destination"}), 404

    from app.services.analytics_service import build_analytics_payload  # local import to avoid cycles

    reports = CrimeReport.query.order_by(CrimeReport.created_at.desc()).all()
    analytics = build_analytics_payload(reports=reports, area_query="", lookback_days=30)
    hotspots = analytics.get("hotspots", [])
    start = (float(origin["location_lat"]), float(origin["location_lng"]))
    end = (float(destination["location_lat"]), float(destination["location_lng"]))

    routing_mode = "road"
    route_candidates = []
    try:
        osrm_routes = _fetch_osrm_routes(start, end, max_routes=3)
    except Exception:
        osrm_routes = []
    if osrm_routes:
        for route in osrm_routes:
            points = [(float(p["lat"]), float(p["lng"])) for p in route["polyline"]]
            route_candidates.append(
                {
                    "id": route["id"],
                    "label": route["label"],
                    "points": points,
                    "distance_km": route["distance_km"],
                    "duration_min": route["duration_min"],
                    "polyline": route["polyline"],
                }
            )
    else:
        routing_mode = "fallback"
        route_candidates = [
            {"id": "direct", "label": "Fastest (Approximate)", "points": _interpolate_route_points(start, end, steps=20)},
            {"id": "north_shift", "label": "Safer Alternative A (Approximate)", "points": _offset_route_points(start, end, direction=1)},
            {"id": "south_shift", "label": "Safer Alternative B (Approximate)", "points": _offset_route_points(start, end, direction=-1)},
        ]

    scored = []
    for candidate in route_candidates:
        exposure, touched = _route_risk_score(candidate["points"], hotspots)
        if "distance_km" in candidate:
            length_km = float(candidate["distance_km"])
        else:
            length_km = 0.0
            points = candidate["points"]
            for idx in range(1, len(points)):
                length_km += _distance_km(points[idx - 1][0], points[idx - 1][1], points[idx][0], points[idx][1])
        safety_score = int(max(5, min(99, round(100 - exposure * 3.4 - max(0.0, length_km - 3.5) * 1.6))))
        polyline = candidate.get("polyline") or [{"lat": round(p[0], 6), "lng": round(p[1], 6)} for p in candidate["points"]]
        scored.append(
            {
                "id": candidate["id"],
                "label": candidate["label"],
                "distance_km": round(length_km, 3),
                "duration_min": candidate.get("duration_min"),
                "risk_exposure": round(exposure, 3),
                "safety_score": safety_score,
                "hotspots_nearby": touched,
                "polyline": polyline,
            }
        )

    scored.sort(key=lambda item: (item["risk_exposure"], item.get("duration_min") or 9999, -item["safety_score"]))
    safest = scored[0]
    return jsonify(
        {
            "origin": {
                "query": origin_query,
                "resolved": origin.get("display_name") or origin_query,
                "lat": start[0],
                "lng": start[1],
            },
            "destination": {
                "query": destination_query,
                "resolved": destination.get("display_name") or destination_query,
                "lat": end[0],
                "lng": end[1],
            },
            "routing_mode": routing_mode,
            "recommended_route_id": safest["id"],
            "routes": scored,
        }
    ), 200


@reports_bp.get("/reports/<int:report_id>/comments")
def get_report_comments(report_id: int):
    report = CrimeReport.query.get_or_404(report_id)
    comments = (
        Comment.query.filter_by(report_id=report.id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    by_parent = defaultdict(list)
    for comment in comments:
        by_parent[comment.parent_id].append(_serialize_comment(comment))

    id_lookup = {}
    for group in by_parent.values():
        for item in group:
            id_lookup[item["id"]] = item

    for parent_id, group in by_parent.items():
        if parent_id is not None and parent_id in id_lookup:
            id_lookup[parent_id]["replies"].extend(group)

    roots = by_parent[None]
    return jsonify(roots), 200


@reports_bp.post("/reports/<int:report_id>/comments")
def create_report_comment(report_id: int):
    report = CrimeReport.query.get_or_404(report_id)
    data = request.get_json(silent=True) or request.form
    content = (data.get("content") or "").strip()
    author_name = (data.get("author_name") or "Citizen").strip()[:80] or "Citizen"
    parent_id = data.get("parent_id")

    if not content:
        return jsonify({"error": "content is required"}), 400
    if len(content) > 500:
        return jsonify({"error": "content must be 500 characters or fewer"}), 400

    parent_comment = None
    if parent_id is not None and str(parent_id).strip() != "":
        try:
            parent_id = int(parent_id)
        except (TypeError, ValueError):
            return jsonify({"error": "parent_id must be an integer"}), 400
        parent_comment = Comment.query.get(parent_id)
        if not parent_comment or parent_comment.report_id != report.id:
            return jsonify({"error": "invalid parent_id for this report"}), 400

    comment = Comment(
        report_id=report.id,
        parent_id=parent_comment.id if parent_comment else None,
        author_name=author_name,
        content=content,
    )
    db.session.add(comment)
    db.session.commit()

    return jsonify(_serialize_comment(comment)), 201


@reports_bp.post("/reports/<int:report_id>/confirm")
def confirm_report(report_id: int):
    report = CrimeReport.query.get_or_404(report_id)
    data = request.get_json(silent=True) or request.form or {}
    action = (data.get("action") or "confirm").strip().lower()
    client_fp = _client_fingerprint()

    existing = ReportConfirmation.query.filter_by(report_id=report.id, client_fingerprint=client_fp).first()
    if action == "remove":
        if existing:
            db.session.delete(existing)
            db.session.commit()
    else:
        if not existing:
            db.session.add(ReportConfirmation(report_id=report.id, client_fingerprint=client_fp))
            db.session.commit()

    count = ReportConfirmation.query.filter_by(report_id=report.id).count()
    is_confirmed = (
        ReportConfirmation.query.filter_by(report_id=report.id, client_fingerprint=client_fp).first() is not None
    )
    return jsonify({"report_id": report.id, "confirmed_count": count, "is_confirmed": is_confirmed}), 200


@reports_bp.get("/reports/alerts/check")
def check_geo_alerts():
    area_query = (request.args.get("area") or "").strip()
    radius_raw = request.args.get("radius_km", "3")
    min_risk_band = (request.args.get("min_risk") or "high").strip().lower()
    if len(area_query) < 3:
        return jsonify({"error": "area must be at least 3 characters"}), 400
    try:
        radius_km = float(radius_raw)
    except ValueError:
        radius_km = 3.0
    radius_km = max(0.5, min(20.0, radius_km))

    risk_rank = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    min_rank = risk_rank.get(min_risk_band, 3)

    try:
        location = geocode_location(area_query)
    except Exception as exc:
        return jsonify({"error": f"Location search failed: {exc}"}), 502
    if not location:
        return jsonify({"error": "No matching location found"}), 404

    from app.services.analytics_service import _distance_km, build_analytics_payload  # local import to avoid cycles

    reports = CrimeReport.query.order_by(CrimeReport.created_at.desc()).all()
    analytics = build_analytics_payload(reports=reports, area_query="", lookback_days=30)
    hotspots = analytics.get("hotspots", [])

    lat = float(location["location_lat"])
    lng = float(location["location_lng"])
    nearby = []
    for hotspot in hotspots:
        dist = _distance_km(lat, lng, hotspot["location_lat"], hotspot["location_lng"])
        band = (hotspot.get("risk_band") or "low").lower()
        if dist <= radius_km and risk_rank.get(band, 1) >= min_rank:
            item = dict(hotspot)
            item["distance_km"] = round(dist, 3)
            nearby.append(item)

    nearby.sort(key=lambda row: (row.get("distance_km", 999), -(row.get("risk_index", 0))))
    should_notify = len(nearby) > 0
    return jsonify(
        {
            "area_query": area_query,
            "resolved_area": location.get("area_name") or location.get("display_name") or area_query,
            "center": {"lat": lat, "lng": lng},
            "radius_km": radius_km,
            "min_risk": min_risk_band,
            "should_notify": should_notify,
            "alerts_count": len(nearby),
            "alerts": nearby[:12],
        }
    ), 200
