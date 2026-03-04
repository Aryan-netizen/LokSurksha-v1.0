import os
from collections import defaultdict

from flask import current_app, request
from flask_socketio import emit

from app.extensions import socketio
from app.models import CrimeReport
from app.schemas import CrimeReportSchema
from app.services.area_service import area_key_from_coords, build_area_name_map
from app.services.evidence_service import analyze_evidence
from app.services.nlp_service import normalize_report_text

report_schema = CrimeReportSchema()


def _area_key(lat: float, lng: float, precision: int = 3) -> tuple[float, float]:
    return (round(lat, precision), round(lng, precision))


def _crime_weight(level: str) -> int:
    weights = {
        "low": 1,
        "medium": 2,
        "high": 3,
    }
    return weights.get((level or "").lower(), 1)


def _level_from_score(score: float) -> str:
    if score >= 12:
        return "critical"
    if score >= 7:
        return "high"
    if score >= 3:
        return "medium"
    return "low"


def build_area_stats(reports: list[CrimeReport]) -> dict[tuple[float, float], dict]:
    stats = defaultdict(lambda: {"count": 0, "score": 0.0})
    for report in reports:
        key = _area_key(report.location_lat, report.location_lng)
        stats[key]["count"] += 1
        stats[key]["score"] += _crime_weight(report.crime_level)
    return stats


def enrich_report(report: CrimeReport, area_stats: dict[tuple[float, float], dict], area_name_map: dict[str, str] | None = None) -> dict:
    return enrich_report_with_meta(report, area_stats, area_name_map=area_name_map)


def _compute_trust_score(
    report: CrimeReport,
    confirmation_count: int = 0,
    otp_verified: bool = False,
    fir_verified: bool = False,
    fir_score: int = 0,
    comment_count: int = 0,
) -> int:
    score = 20.0
    if otp_verified:
        score += 20
    if fir_verified:
        score += 22
        score += min(18, max(0, fir_score) * 0.18)
    if report.image_url:
        score += 10
    score += min(16, confirmation_count * 3.5)
    score += min(8, comment_count * 1.5)
    return int(max(0, min(100, round(score))))


def enrich_report_with_meta(
    report: CrimeReport,
    area_stats: dict[tuple[float, float], dict],
    area_name_map: dict[str, str] | None = None,
    confirmation_counts: dict[int, int] | None = None,
    verification_map: dict[int, dict] | None = None,
    comment_counts: dict[int, int] | None = None,
    confirmed_report_ids: set[int] | None = None,
) -> dict:
    payload = report_schema.dump(report)
    stats = area_stats[_area_key(report.location_lat, report.location_lng)]
    area_key = area_key_from_coords(report.location_lat, report.location_lng)
    if area_name_map is None:
        area_name_map = build_area_name_map([area_key])
    confirmation_counts = confirmation_counts or {}
    verification_map = verification_map or {}
    comment_counts = comment_counts or {}
    verification = verification_map.get(report.id, {})
    confirmation_count = int(confirmation_counts.get(report.id, 0))
    comment_count = int(comment_counts.get(report.id, 0))
    trust_score = _compute_trust_score(
        report=report,
        confirmation_count=confirmation_count,
        otp_verified=bool(verification.get("otp_verified")),
        fir_verified=bool(verification.get("fir_verified")),
        fir_score=int(verification.get("fir_score", 0) or 0),
        comment_count=comment_count,
    )
    payload["area_count"] = stats["count"]
    payload["area_score"] = round(stats["score"], 2)
    payload["area_level"] = _level_from_score(stats["score"])
    payload["heat_value"] = round(stats["score"], 2)
    payload["area_name"] = area_name_map.get(area_key, area_key)
    payload["area_key"] = area_key
    payload["confirmed_count"] = confirmation_count
    payload["otp_verified"] = bool(verification.get("otp_verified"))
    payload["fir_verified"] = bool(verification.get("fir_verified"))
    payload["fir_score"] = int(verification.get("fir_score", 0) or 0)
    payload["trust_score"] = trust_score
    payload["is_confirmed"] = bool(confirmed_report_ids and report.id in confirmed_report_ids)
    payload["comments_count"] = comment_count
    nlp = normalize_report_text(report.description)
    payload["normalized_description"] = nlp.get("normalized_text", "")
    payload["language_hint"] = nlp.get("language_hint", "en")
    payload["nlp_keywords"] = nlp.get("keywords", [])
    payload["ai_summary"] = nlp.get("summary", "")
    payload["ai_category"] = nlp.get("category", "general")
    payload["ai_category_confidence"] = float(nlp.get("category_confidence", 0.0) or 0.0)
    payload["ai_urgency_hint"] = nlp.get("urgency_hint", "low")

    evidence = {
        "has_evidence": False,
        "is_sensitive": False,
        "auto_blur": False,
        "quality_ok": False,
        "quality_flags": {},
        "tips": [],
    }
    if report.image_url:
        image_name = os.path.basename(report.image_url)
        image_path = os.path.join(current_app.config.get("UPLOAD_FOLDER", ""), image_name)
        evidence = analyze_evidence(image_path, description=report.description)
    payload["evidence_analysis"] = evidence
    payload["has_sensitive_evidence"] = bool(evidence.get("is_sensitive"))
    payload["evidence_auto_blur"] = bool(evidence.get("auto_blur"))
    return payload


def build_heatmap_payload(area_stats: dict[tuple[float, float], dict]) -> dict:
    if not area_stats:
        return {"max_count": 0, "max_score": 0, "areas": []}

    max_count = max(area["count"] for area in area_stats.values())
    max_score = max(area["score"] for area in area_stats.values())
    area_keys = [area_key_from_coords(lat, lng) for lat, lng in area_stats.keys()]
    area_name_map = build_area_name_map(area_keys)
    areas = []
    for (lat, lng), area in area_stats.items():
        count = area["count"]
        score = area["score"]
        intensity = round(score / max_score, 3) if max_score else 0
        area_key = area_key_from_coords(lat, lng)
        areas.append(
            {
                "location_lat": lat,
                "location_lng": lng,
                "area_key": area_key,
                "area_name": area_name_map.get(area_key, area_key),
                "count": count,
                "score": round(score, 2),
                "area_level": _level_from_score(score),
                "intensity": intensity,
            }
        )

    return {"max_count": max_count, "max_score": round(max_score, 2), "areas": areas}


def get_current_state_payload() -> dict:
    reports = CrimeReport.query.order_by(CrimeReport.created_at.desc()).all()
    area_stats = build_area_stats(reports)
    area_name_map = build_area_name_map([area_key_from_coords(lat, lng) for lat, lng in area_stats.keys()])
    return {
        "reports": [enrich_report_with_meta(report, area_stats, area_name_map=area_name_map) for report in reports],
        "heatmap": build_heatmap_payload(area_stats),
    }


def emit_new_report_updates(new_report: CrimeReport) -> dict:
    reports = CrimeReport.query.all()
    area_stats = build_area_stats(reports)
    area_name_map = build_area_name_map([area_key_from_coords(lat, lng) for lat, lng in area_stats.keys()])
    report_payload = enrich_report_with_meta(new_report, area_stats, area_name_map=area_name_map)
    heatmap_payload = build_heatmap_payload(area_stats)
    socketio.emit("new_report", report_payload, namespace="/")
    socketio.emit("heatmap_update", heatmap_payload, namespace="/")
    return report_payload


def register_socket_handlers() -> None:
    @socketio.on("connect")
    def _handle_connect():
        emit("reports_snapshot", get_current_state_payload())

    @socketio.on("request_state")
    def _handle_request_state():
        emit("reports_snapshot", get_current_state_payload())
