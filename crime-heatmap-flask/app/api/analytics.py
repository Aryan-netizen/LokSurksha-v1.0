from flask import Blueprint, jsonify, request

from app.models import CrimeReport
from app.services.analytics_service import build_analytics_payload

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/reports/analytics")
def get_reports_analytics():
    query = (request.args.get("area") or "").strip()
    lookback_raw = request.args.get("days", "30")
    try:
        lookback_days = int(lookback_raw)
    except ValueError:
        lookback_days = 30
    lookback_days = max(7, min(180, lookback_days))

    reports = CrimeReport.query.order_by(CrimeReport.created_at.desc()).all()
    payload = build_analytics_payload(reports=reports, area_query=query, lookback_days=lookback_days)
    return jsonify(payload), 200
