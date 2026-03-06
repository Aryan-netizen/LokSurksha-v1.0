#!/usr/bin/env bash
set -e

echo "=== Starting Crime Heatmap Backend ==="
echo "Python version: $(python --version)"
echo "Working directory: $(pwd)"
echo "DATABASE_URL set: ${DATABASE_URL:+yes}"
echo "PORT: ${PORT:-not set}"

# Initialize database
echo "=== Initializing database ==="
python -c "
from app import create_app, db
app = create_app()
with app.app_context():
    db.create_all()
    print('✓ Database initialized')
" || echo "⚠ Database init failed (may be normal if tables exist)"

# Start server
echo "=== Starting Gunicorn ==="
exec gunicorn \
    --worker-class eventlet \
    -w 1 \
    --bind 0.0.0.0:${PORT:-5000} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    app:app

