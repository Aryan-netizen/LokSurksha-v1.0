"""WSGI entry point for production deployment."""
from app import create_app, socketio

# Create the Flask application instance
app = create_app()

if __name__ == "__main__":
    # For local development only
    socketio.run(app, host='0.0.0.0', port=5000)
