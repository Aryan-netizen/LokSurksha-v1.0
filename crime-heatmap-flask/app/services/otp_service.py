import secrets
import threading
import time
from dataclasses import dataclass


@dataclass
class OtpSession:
    phone: str
    code: str
    expires_at: float
    verified: bool = False


@dataclass
class VerifiedToken:
    phone: str
    expires_at: float
    consumed: bool = False


_lock = threading.Lock()
_otp_sessions: dict[str, OtpSession] = {}
_verified_tokens: dict[str, VerifiedToken] = {}


def _cleanup(now: float) -> None:
    expired_sessions = [sid for sid, sess in _otp_sessions.items() if sess.expires_at < now]
    for sid in expired_sessions:
        _otp_sessions.pop(sid, None)

    expired_tokens = [tok for tok, info in _verified_tokens.items() if info.expires_at < now]
    for tok in expired_tokens:
        _verified_tokens.pop(tok, None)


def _mask_phone(phone: str) -> str:
    compact = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if len(compact) <= 4:
        return compact
    return f"{compact[:-4].replace(compact[:-4], '*' * len(compact[:-4]))}{compact[-4:]}"


def create_otp_session(phone: str, expiry_seconds: int) -> tuple[str, str, str]:
    now = time.time()
    session_id = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(1000000):06d}"
    masked_phone = _mask_phone(phone)
    with _lock:
        _cleanup(now)
        _otp_sessions[session_id] = OtpSession(
            phone=phone,
            code=code,
            expires_at=now + expiry_seconds,
        )
    return session_id, code, masked_phone


def verify_otp_code(session_id: str, code: str, token_expiry_seconds: int) -> tuple[bool, str]:
    now = time.time()
    with _lock:
        _cleanup(now)
        session = _otp_sessions.get(session_id)
        if not session:
            return False, "OTP session not found or expired"
        if session.expires_at < now:
            _otp_sessions.pop(session_id, None)
            return False, "OTP expired"
        if session.code != code:
            return False, "Invalid OTP"

        session.verified = True
        verified_token = secrets.token_urlsafe(32)
        _verified_tokens[verified_token] = VerifiedToken(
            phone=session.phone,
            expires_at=now + token_expiry_seconds,
            consumed=False,
        )
    return True, verified_token


def consume_verified_token(token: str, phone: str) -> tuple[bool, str]:
    now = time.time()
    with _lock:
        _cleanup(now)
        info = _verified_tokens.get(token)
        if not info:
            return False, "OTP verification token is missing or expired"
        if info.consumed:
            return False, "OTP token already used"
        if info.phone != phone:
            return False, "OTP token does not match phone number"
        if info.expires_at < now:
            _verified_tokens.pop(token, None)
            return False, "OTP verification token expired"
        info.consumed = True
    return True, ""
