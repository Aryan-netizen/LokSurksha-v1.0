from flask import Blueprint

api_bp = Blueprint('api', __name__)

from .auth import auth_bp
from .analytics import analytics_bp
from .fir import fir_bp
from .reports import reports_bp

api_bp.register_blueprint(auth_bp)
api_bp.register_blueprint(reports_bp)
api_bp.register_blueprint(analytics_bp)
api_bp.register_blueprint(fir_bp)
