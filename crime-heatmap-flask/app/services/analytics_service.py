from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from app.models import CrimeReport
from app.services.area_service import area_key_from_coords, build_area_name_map

CRIME_WEIGHTS = {"low": 1.0, "medium": 2.0, "high": 3.0}


def _to_utc(value: datetime) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _area_key(lat: float, lng: float, precision: int = 3) -> tuple[float, float]:
    return (round(lat, precision), round(lng, precision))


def _daterange(start_day: date, end_day: date) -> list[date]:
    days: list[date] = []
    cursor = start_day
    while cursor <= end_day:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _std_dev(values: list[float], mean_value: float) -> float:
    if len(values) < 2:
        return 0.0
    variance = sum((v - mean_value) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def _z_score(value: float, mean_value: float, std_value: float) -> float:
    if std_value <= 0:
        return 0.0
    return (value - mean_value) / std_value


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def _risk_band(index: float) -> str:
    if index >= 0.85:
        return "critical"
    if index >= 0.65:
        return "high"
    if index >= 0.4:
        return "medium"
    return "low"


def _parse_area_query(query: str) -> tuple[float, float] | None:
    if not query:
        return None
    compact = query.strip().replace(" ", "")
    if "," not in compact:
        return None
    parts = compact.split(",", 1)
    try:
        return (float(parts[0]), float(parts[1]))
    except ValueError:
        return None


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(1e-9, 1 - a)))
    return radius * c


def _trend_direction(delta: float) -> str:
    if delta >= 0.15:
        return "up"
    if delta <= -0.15:
        return "down"
    return "stable"


def _build_forecast(hotspots: list[dict], lookback_days: int) -> dict:
    if not hotspots:
        return {
            "lookback_days": lookback_days,
            "next_7d_total": 0.0,
            "next_30d_total": 0.0,
            "risky_areas": [],
        }

    risky_areas = []
    next_7d_total = 0.0
    next_30d_total = 0.0
    for spot in hotspots[:8]:
        daily = float(spot.get("predicted_reports_next_24h") or 0.0)
        trend_ratio = float(spot.get("trend_ratio") or 0.0)
        risk = float(spot.get("risk_index") or 0.0)
        trend_boost = 1.0 + max(-0.2, min(0.35, trend_ratio * 0.5))
        seven_day = round(max(0.0, daily * 7.0 * trend_boost), 2)
        thirty_day = round(max(0.0, daily * 30.0 * trend_boost), 2)
        next_7d_total += seven_day
        next_30d_total += thirty_day
        confidence = round(min(0.98, 0.45 + (risk * 0.4) + min(0.13, spot.get("count", 0) / 300)), 3)
        risky_areas.append(
            {
                "area_key": spot.get("area_key"),
                "area_name": spot.get("area_name"),
                "risk_band": spot.get("risk_band"),
                "trend_direction": spot.get("trend_direction"),
                "predicted_next_7d": seven_day,
                "predicted_next_30d": thirty_day,
                "confidence": confidence,
            }
        )

    risky_areas.sort(key=lambda item: (item["predicted_next_7d"], item["predicted_next_30d"]), reverse=True)
    return {
        "lookback_days": lookback_days,
        "next_7d_total": round(next_7d_total, 2),
        "next_30d_total": round(next_30d_total, 2),
        "risky_areas": risky_areas[:5],
    }


def _build_danger_now(reports: list[CrimeReport], now: datetime, hotspots: list[dict]) -> dict:
    if not reports:
        return {
            "status": "normal",
            "current_2h_reports": 0,
            "baseline_2h_reports": 0.0,
            "pressure_index": 0.0,
            "surge_areas": [],
            "message": "No recent activity in the last 2 hours.",
        }

    recent_start = now - timedelta(hours=2)
    baseline_start = now - timedelta(hours=24)
    recent_reports = [r for r in reports if _to_utc(r.created_at) >= recent_start]
    baseline_reports = [
        r
        for r in reports
        if baseline_start <= _to_utc(r.created_at) < recent_start
    ]
    baseline_2h = (len(baseline_reports) / 11.0) if baseline_reports else 0.0
    pressure = round(len(recent_reports) / max(1.0, baseline_2h), 3)

    surge_candidates = []
    hotspot_lookup = {item.get("area_key"): item for item in hotspots}
    by_area: dict[str, int] = defaultdict(int)
    for report in recent_reports:
        key = area_key_from_coords(report.location_lat, report.location_lng)
        by_area[key] += 1
    for area_key, count in by_area.items():
        if count <= 0:
            continue
        hotspot = hotspot_lookup.get(area_key, {})
        surge_candidates.append(
            {
                "area_key": area_key,
                "area_name": hotspot.get("area_name", area_key),
                "reports_last_2h": count,
                "risk_band": hotspot.get("risk_band", "low"),
                "risk_index": hotspot.get("risk_index", 0.0),
            }
        )
    surge_candidates.sort(
        key=lambda item: (item["reports_last_2h"], item["risk_index"]),
        reverse=True,
    )
    surge_areas = surge_candidates[:5]

    if len(recent_reports) >= 6 or pressure >= 2.4:
        status = "critical"
    elif len(recent_reports) >= 3 or pressure >= 1.6:
        status = "elevated"
    else:
        status = "normal"
    status_message = {
        "critical": "Critical short-term risk pressure detected. Trigger immediate response workflow.",
        "elevated": "Elevated short-term risk detected. Increase patrol and citizen alerts.",
        "normal": "Short-term activity is within normal operating range.",
    }

    return {
        "status": status,
        "current_2h_reports": len(recent_reports),
        "baseline_2h_reports": round(baseline_2h, 2),
        "pressure_index": pressure,
        "surge_areas": surge_areas,
        "message": status_message[status],
    }


def build_analytics_payload(reports: list[CrimeReport], area_query: str = "", lookback_days: int = 30) -> dict:
    now = datetime.now(timezone.utc)
    by_level = {"low": 0, "medium": 0, "high": 0}
    by_area: dict[tuple[float, float], dict] = defaultdict(
        lambda: {
            "count": 0,
            "score": 0.0,
            "reports": [],
            "level_counts": {"low": 0, "medium": 0, "high": 0},
            "last_seen": None,
        }
    )
    by_day: dict[date, int] = defaultdict(int)
    weighted_by_day: dict[date, float] = defaultdict(float)

    for report in reports:
        created_at = _to_utc(report.created_at)
        level = (report.crime_level or "low").lower()
        weight = CRIME_WEIGHTS.get(level, 1.0)
        day = created_at.date()
        area = _area_key(report.location_lat, report.location_lng)

        if level in by_level:
            by_level[level] += 1
        by_day[day] += 1
        weighted_by_day[day] += weight
        by_area[area]["count"] += 1
        by_area[area]["score"] += weight
        by_area[area]["reports"].append(report)
        by_area[area]["level_counts"][level if level in by_level else "low"] += 1
        if by_area[area]["last_seen"] is None or created_at > by_area[area]["last_seen"]:
            by_area[area]["last_seen"] = created_at

    start_day = (now - timedelta(days=max(lookback_days - 1, 0))).date()
    days = _daterange(start_day, now.date())
    daily_counts = [float(by_day.get(d, 0)) for d in days]
    daily_weighted = [float(weighted_by_day.get(d, 0.0)) for d in days]
    avg_daily = round(_mean(daily_counts), 3)
    weighted_avg_daily = round(_mean(daily_weighted), 3)
    daily_mean = _mean(daily_counts)
    daily_std = _std_dev(daily_counts, daily_mean)

    ewma_alpha = 0.38
    ewma_value = 0.0
    timeline = []
    for i, day in enumerate(days):
        count = daily_counts[i]
        weighted_count = daily_weighted[i]
        ewma_value = ewma_alpha * count + (1 - ewma_alpha) * ewma_value
        trailing = daily_counts[max(0, i - 6) : i + 1]
        trailing_avg = _mean(trailing)
        z = _z_score(count, daily_mean, daily_std)
        timeline.append(
            {
                "date": day.isoformat(),
                "count": int(count),
                "weighted_count": round(weighted_count, 2),
                "ewma": round(ewma_value, 3),
                "trailing_avg_7d": round(trailing_avg, 3),
                "z_score": round(z, 3),
            }
        )

    area_name_map = build_area_name_map([area_key_from_coords(lat, lng) for lat, lng in by_area.keys()])
    hotspots = []
    for (lat, lng), stats in by_area.items():
        reports_in_area: list[CrimeReport] = stats["reports"]
        recent_window = now - timedelta(days=2)
        previous_window = now - timedelta(days=5)

        recent_48h = sum(1 for r in reports_in_area if _to_utc(r.created_at) >= recent_window)
        previous_72h = sum(
            1
            for r in reports_in_area
            if previous_window <= _to_utc(r.created_at) < recent_window
        )
        growth = (recent_48h - previous_72h) / max(1, previous_72h)
        recency_hours = max(0.0, (now - _to_utc(stats["last_seen"])).total_seconds() / 3600.0)
        recency_factor = math.exp(-recency_hours / 36.0)
        anomaly = _z_score(stats["count"], _mean([a["count"] for a in by_area.values()]), _std_dev([float(a["count"]) for a in by_area.values()], _mean([float(a["count"]) for a in by_area.values()])))

        raw_score = (
            0.48 * (stats["score"] / max(1.0, weighted_avg_daily))
            + 0.24 * max(growth, -0.5)
            + 0.18 * recency_factor
            + 0.10 * max(0.0, anomaly / 3.0)
        )
        risk_index = round(_sigmoid(raw_score), 4)
        predicted_24h = round(max(0.0, 0.55 * recent_48h + 0.45 * stats["count"] / max(1.0, lookback_days / 3)), 2)

        area_key = area_key_from_coords(lat, lng)
        area_name = area_name_map.get(area_key, area_key)
        hotspots.append(
            {
                "area_key": area_key,
                "area_name": area_name,
                "location_lat": lat,
                "location_lng": lng,
                "count": stats["count"],
                "score": round(stats["score"], 2),
                "risk_index": risk_index,
                "risk_band": _risk_band(risk_index),
                "trend_ratio": round(growth, 3),
                "trend_direction": _trend_direction(growth),
                "anomaly_score": round(anomaly, 3),
                "predicted_reports_next_24h": predicted_24h,
                "level_counts": stats["level_counts"],
                "last_seen": _to_utc(stats["last_seen"]).isoformat() if stats["last_seen"] else None,
            }
        )

    hotspots.sort(key=lambda item: (item["risk_index"], item["score"], item["count"]), reverse=True)
    area_query_value = (area_query or "").strip()
    query_results = hotspots

    parsed = _parse_area_query(area_query_value)
    if parsed:
        lat, lng = parsed
        query_results = sorted(
            hotspots,
            key=lambda item: _distance_km(lat, lng, item["location_lat"], item["location_lng"]),
        )
        for item in query_results:
            item["distance_km"] = round(
                _distance_km(lat, lng, item["location_lat"], item["location_lng"]),
                3,
            )
    elif area_query_value:
        lowered = area_query_value.lower()
        query_results = [
            item
            for item in hotspots
            if lowered in item["area_key"] or lowered in item["area_name"].lower() or lowered in item["risk_band"]
        ]
        if not query_results:
            # Fallback so the UI still returns meaningful ranked hotspots.
            query_results = hotspots

    alert_days = [point for point in timeline[-7:] if point["z_score"] >= 1.5]
    recommendations = [
        "Increase patrol rounds in top 3 hotspots during evening windows.",
        "Trigger community alerts for areas with positive trend and high anomaly score.",
        "Run focused verification on repeated coordinates to reduce false positives.",
    ]
    if hotspots and hotspots[0]["risk_band"] in {"high", "critical"}:
        recommendations.insert(0, f"Immediate response recommended near {hotspots[0]['area_name']} (risk {hotspots[0]['risk_band']}).")
    forecast = _build_forecast(hotspots, lookback_days=lookback_days)
    danger_now = _build_danger_now(reports, now=now, hotspots=hotspots)
    if danger_now["status"] == "critical":
        recommendations.insert(0, "Live signal: short-term danger pressure is critical in the last 2 hours.")
    elif danger_now["status"] == "elevated":
        recommendations.insert(0, "Live signal: short-term danger pressure is elevated in the last 2 hours.")

    return {
        "summary": {
            "total_reports": len(reports),
            "level_counts": by_level,
            "avg_daily_reports": avg_daily,
            "weighted_avg_daily": weighted_avg_daily,
            "spike_days_last_7d": len(alert_days),
            "model_confidence": round(min(0.99, 0.52 + min(len(reports), 400) / 1000), 3),
        },
        "timeline": timeline,
        "hotspots": hotspots,
        "search": {
            "query": area_query_value,
            "matched_count": len(query_results),
            "results": query_results[:10],
            "supports": "Use coordinates like '28.614,77.209' or risk text like 'high'.",
        },
        "model": {
            "name": "Hybrid Hotspot Risk Model",
            "version": "v2.1",
            "components": [
                "Weighted severity scoring",
                "EWMA temporal trend",
                "Z-score anomaly detection",
                "Recency decay factor",
            ],
            "weights": {
                "severity": 0.48,
                "trend": 0.24,
                "recency": 0.18,
                "anomaly": 0.10,
            },
        },
        "forecast": forecast,
        "danger_now": danger_now,
        "recommendations": recommendations,
    }
