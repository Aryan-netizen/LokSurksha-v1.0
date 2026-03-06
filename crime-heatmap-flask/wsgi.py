"""WSGI entry point for production deployment."""
import sys
import os

# Ensure the app directory is in the path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, socketio

# Create the Flask application instance
application = create_app()
app = application  # Alias for gunicorn

if __name__ == "__main__":
    # For local development only
    socketio.run(application, host='0.0.0.0', port=5000)
