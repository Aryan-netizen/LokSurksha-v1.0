from flask import Blueprint, jsonify, request

from app.services.fir_verify_service import verify_fir_payload

fir_bp = Blueprint("fir", __name__)


@fir_bp.post("/fir/verify")
def verify_fir():
    data = request.form if request.form else (request.get_json(silent=True) or {})

    state = (data.get("state") or "").strip()
    police_station = (data.get("police_station") or "").strip()
    fir_number = (data.get("fir_number") or "").strip()
    fir_date = (data.get("fir_date") or "").strip()
    ipc_sections = (data.get("ipc_sections") or "").strip()

    if not state or not police_station or not fir_number or not fir_date:
        return jsonify({"error": "state, police_station, fir_number, and fir_date are required"}), 400

    result = verify_fir_payload(
        state=state,
        police_station=police_station,
        fir_number=fir_number,
        fir_date=fir_date,
        ipc_sections=ipc_sections,
    )
    return jsonify(result), 200
