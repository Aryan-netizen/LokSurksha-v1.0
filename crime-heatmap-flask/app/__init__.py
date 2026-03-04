import os

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError
from .config import Config
from .extensions import db, socketio
from .api import api_bp
from .services.socket_service import register_socket_handlers

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": "*"}, r"/uploads/*": {"origins": "*"}})
    configured_upload = app.config["UPLOAD_FOLDER"]
    upload_path = os.path.abspath(os.path.join(app.root_path, "..", configured_upload))
    if os.path.exists(upload_path) and not os.path.isdir(upload_path):
        upload_path = os.path.join(app.instance_path, "uploads")
    os.makedirs(upload_path, exist_ok=True)
    app.config["UPLOAD_FOLDER"] = upload_path
    app.config["UPLOAD_URL_PREFIX"] = "/uploads"

    db.init_app(app)
    socketio.init_app(
        app,
        async_mode="threading",
        message_queue=app.config.get("SOCKETIO_MESSAGE_QUEUE"),
        cors_allowed_origins="*",
    )
    register_socket_handlers()

    app.register_blueprint(api_bp, url_prefix='/api')
    required_tables = {
        "crime_reports",
        "comments",
        "report_tags",
        "area_aliases",
        "report_confirmations",
        "report_verifications",
        "submission_audits",
    }
    tables_verified = {"done": False}

    def _ensure_tables() -> None:
        if tables_verified["done"]:
            return
        try:
            inspector = inspect(db.engine)
            existing = set(inspector.get_table_names())
            if not required_tables.issubset(existing):
                db.create_all()
            tables_verified["done"] = True
        except SQLAlchemyError:
            # Keep request flow alive; API routes will still return DB errors if unavailable.
            tables_verified["done"] = False

    with app.app_context():
        _ensure_tables()

    @app.before_request
    def _bootstrap_tables_once():
        _ensure_tables()

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    return app
