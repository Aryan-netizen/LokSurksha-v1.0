from flask import Blueprint, current_app, jsonify, request

from app.services.otp_service import create_otp_session, verify_otp_code
from app.services.sms_service import send_otp_sms

auth_bp = Blueprint("auth", __name__)


def _is_valid_phone(phone: str) -> bool:
    if not phone:
        return False
    compact = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    digits = "".join(ch for ch in compact if ch.isdigit())
    return 10 <= len(digits) <= 15


@auth_bp.post("/auth/otp/send")
def send_otp():
    data = request.get_json(silent=True) or request.form
    phone = (data.get("phone") or "").strip()
    if not _is_valid_phone(phone):
        return jsonify({"error": "Valid phone is required"}), 400

    session_id, code, masked_phone = create_otp_session(
        phone=phone,
        expiry_seconds=current_app.config["OTP_EXPIRY_SECONDS"],
    )
    delivery_warning = None
    try:
        send_otp_sms(phone=phone, code=code, config=current_app.config)
    except Exception as exc:
        if not current_app.config.get("OTP_DEV_MODE", True):
            return jsonify({"error": f"OTP delivery failed: {exc}"}), 502
        delivery_warning = str(exc)

    response = {
        "session_id": session_id,
        "masked_phone": masked_phone,
        "expires_in": current_app.config["OTP_EXPIRY_SECONDS"],
        "provider": current_app.config.get("OTP_PROVIDER", "console"),
    }
    if current_app.config.get("OTP_DEV_MODE", True):
        response["dev_otp_code"] = code
        if delivery_warning:
            response["delivery_warning"] = delivery_warning
    return jsonify(response), 200


@auth_bp.post("/auth/otp/verify")
def verify_otp():
    data = request.get_json(silent=True) or request.form
    session_id = (data.get("session_id") or "").strip()
    code = (data.get("otp_code") or "").strip()
    if not session_id or not code:
        return jsonify({"error": "session_id and otp_code are required"}), 400

    ok, result = verify_otp_code(
        session_id=session_id,
        code=code,
        token_expiry_seconds=current_app.config["OTP_VERIFIED_TOKEN_EXPIRY_SECONDS"],
    )
    if not ok:
        return jsonify({"error": result}), 400
    return jsonify(
        {
            "otp_token": result,
            "expires_in": current_app.config["OTP_VERIFIED_TOKEN_EXPIRY_SECONDS"],
        }
    ), 200
