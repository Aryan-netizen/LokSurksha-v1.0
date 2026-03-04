import requests


def _normalize_e164(phone: str) -> str:
    if not phone:
        return ""
    compact = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if compact.startswith("+"):
        return "+" + "".join(ch for ch in compact[1:] if ch.isdigit())
    return "".join(ch for ch in compact if ch.isdigit())


def send_otp_sms(phone: str, code: str, config) -> None:
    provider = (config.get("OTP_PROVIDER") or "console").lower()
    message = f"Your LokSurksha OTP is {code}. It expires in {config.get('OTP_EXPIRY_SECONDS', 300)} seconds."

    if provider == "console":
        print(f"[OTP-CONSOLE] phone={phone} code={code}")
        return

    if provider == "twilio":
        account_sid = config.get("TWILIO_ACCOUNT_SID")
        auth_token = config.get("TWILIO_AUTH_TOKEN")
        from_number = _normalize_e164(config.get("TWILIO_FROM_NUMBER"))
        to_number = _normalize_e164(phone)
        if not account_sid or not auth_token or not from_number:
            raise RuntimeError("Twilio credentials are missing")
        if not to_number.startswith("+"):
            raise RuntimeError("Phone must be in E.164 format (e.g. +919876543210) for Twilio")
        if not from_number.startswith("+"):
            raise RuntimeError("TWILIO_FROM_NUMBER must be in E.164 format (e.g. +14155551234)")

        endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        response = requests.post(
            endpoint,
            data={
                "Body": message,
                "From": from_number,
                "To": to_number,
            },
            auth=(account_sid, auth_token),
            timeout=15,
        )
        if response.status_code >= 400:
            details = response.text
            try:
                details = response.json().get("message") or details
            except ValueError:
                pass
            raise RuntimeError(f"Twilio API error ({response.status_code}): {details}")
        return

    raise RuntimeError(f"Unsupported OTP_PROVIDER: {provider}")
