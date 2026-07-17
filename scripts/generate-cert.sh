#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT/certs"
CERT="$CERT_DIR/cert.pem"
KEY="$CERT_DIR/key.pem"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

mkdir -p "$CERT_DIR"
if [[ ( -f "$CERT" || -f "$KEY" ) && "$FORCE" -ne 1 ]]; then
  echo "Certificate already present in $CERT_DIR — pass --force to overwrite." >&2
  exit 0
fi

openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout "$KEY" -out "$CERT" \
  -subj "/C=FR/O=Knowly/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY"
echo "Wrote $CERT and $KEY (valid 365 days)."
