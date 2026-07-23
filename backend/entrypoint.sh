#!/usr/bin/env bash
set -euo pipefail

bash /app/scripts/check-env.sh
python -m app.wait_for_db
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
