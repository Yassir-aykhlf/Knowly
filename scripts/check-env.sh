#!/usr/bin/env bash
set -euo pipefail

REQUIRED=(DATABASE_URL SECRET_KEY POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB FRONTEND_ORIGIN)

missing=()
for var in "${REQUIRED[@]}"; do
  [[ -z "${!var:-}" ]] && missing+=("$var")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: missing required environment variables: ${missing[*]}" >&2
  echo "Copy env.example to .env and fill them in." >&2
  exit 1
fi
echo "Environment looks good."
