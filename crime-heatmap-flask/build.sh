#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

# Run database migrations
python -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all()"
