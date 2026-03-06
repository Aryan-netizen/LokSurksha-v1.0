import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _default_sqlite_uri() -> str:
    db_dir = Path(tempfile.gettempdir()) / "loksurksha"
    db_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{(db_dir / 'loksurksha.db').as_posix()}"


def _resolve_database_uri() -> str:
    database_url = (os.environ.get("DATABASE_URL") or "").strip()
    if database_url:
        # Render uses postgres:// but SQLAlchemy needs postgresql://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        return database_url
    return _default_sqlite_uri()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your_default_secret_key'
    SQLALCHEMY_DATABASE_URI = _resolve_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # Limit upload size to 16 MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    SOCKETIO_MESSAGE_QUEUE = os.environ.get('REDIS_URL')
    REQUIRE_REPORT_OTP = os.environ.get("REQUIRE_REPORT_OTP", "true").lower() == "true"
    OTP_EXPIRY_SECONDS = int(os.environ.get("OTP_EXPIRY_SECONDS", "300"))
    OTP_VERIFIED_TOKEN_EXPIRY_SECONDS = int(os.environ.get("OTP_VERIFIED_TOKEN_EXPIRY_SECONDS", "900"))
    OTP_DEV_MODE = os.environ.get("OTP_DEV_MODE", "true").lower() == "true"
    OTP_PROVIDER = os.environ.get("OTP_PROVIDER", "console").lower()
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")
    REQUIRE_FIR_FOR_REPORTS = os.environ.get("REQUIRE_FIR_FOR_REPORTS", "true").lower() == "true"
    MIN_FIR_VERIFY_SCORE = int(os.environ.get("MIN_FIR_VERIFY_SCORE", "75"))
    REQUIRE_FIR_DOCUMENT = os.environ.get("REQUIRE_FIR_DOCUMENT", "false").lower() == "true"
    HYPERVERGE_FIR_VERIFY_URL = os.environ.get("HYPERVERGE_FIR_VERIFY_URL", "").strip()
    HYPERVERGE_APP_ID = os.environ.get("HYPERVERGE_APP_ID", "").strip()
    HYPERVERGE_APP_KEY = os.environ.get("HYPERVERGE_APP_KEY", "").strip()
    HYPERVERGE_BEARER_TOKEN = os.environ.get("HYPERVERGE_BEARER_TOKEN", "").strip()
    HYPERVERGE_HTTP_METHOD = os.environ.get("HYPERVERGE_HTTP_METHOD", "POST").strip().upper()
    HYPERVERGE_TIMEOUT_SECONDS = int(os.environ.get("HYPERVERGE_TIMEOUT_SECONDS", "20"))
    REPORT_RATE_LIMIT_COUNT = int(os.environ.get("REPORT_RATE_LIMIT_COUNT", "5"))
    REPORT_RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("REPORT_RATE_LIMIT_WINDOW_SECONDS", "300"))
    DUPLICATE_REPORT_WINDOW_SECONDS = int(os.environ.get("DUPLICATE_REPORT_WINDOW_SECONDS", "900"))
    BLOCK_SUSPICIOUS_REPORTS = os.environ.get("BLOCK_SUSPICIOUS_REPORTS", "true").lower() == "true"
    SUSPICIOUS_SCORE_BLOCK_THRESHOLD = int(os.environ.get("SUSPICIOUS_SCORE_BLOCK_THRESHOLD", "65"))
