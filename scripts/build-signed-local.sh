#!/usr/bin/env bash
set -euo pipefail

# Builds a signed macOS bundle using a temporary keychain, mirroring CI.
# Requires env vars:
#   APPLE_CERTIFICATE (base64 p12), APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY
# Optionally:
#   TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD

if [[ -z "${APPLE_CERTIFICATE:-}" || -z "${APPLE_CERTIFICATE_PASSWORD:-}" || -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  cat >&2 <<'EOF'
Missing signing environment variables.

Set:
  - APPLE_CERTIFICATE (base64-encoded .p12)
  - APPLE_CERTIFICATE_PASSWORD
  - APPLE_SIGNING_IDENTITY (e.g. "Developer ID Application: ... (TEAMID)")
EOF
  exit 2
fi

if ! command -v security >/dev/null 2>&1; then
  echo "security command not found (macOS only)." >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  # Best-effort cleanup
  security delete-keychain "${KEYCHAIN_PATH:-}" >/dev/null 2>&1 || true
  rm -rf "${TMP_DIR}" || true
}
trap cleanup EXIT

CERT_PATH="$TMP_DIR/apple_certificate.p12"
KEYCHAIN_PATH="$TMP_DIR/ai-terminal-signing.keychain-db"
KEYCHAIN_PASSWORD="local-$(date +%s)"

# Decode cert
python3 - <<'PY'
import base64, os, re
cert_path = os.environ['CERT_PATH']
data = os.environ['APPLE_CERTIFICATE']
data = re.sub(r'\s+', '', data)
with open(cert_path, 'wb') as f:
  f.write(base64.b64decode(data))
PY

# Create + configure keychain
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

# Make this keychain the default just for this shell run
security default-keychain -s "$KEYCHAIN_PATH"
security list-keychains -d user -s "$KEYCHAIN_PATH"

# Import cert + allow codesign access
security import "$CERT_PATH" -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

echo "Available code signing identities:"
security find-identity -v -p codesigning || true

echo "Building with APPLE_SIGNING_IDENTITY set (not notarizing during build)..."
export APPLE_SIGNING_IDENTITY
unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER || true

npm -s run tauri build
