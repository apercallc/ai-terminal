#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-}"
DMG_PATH="${2:-}"
if [[ -z "${APP_PATH}" ]]; then
  echo "Usage: scripts/notarize-local.sh /path/to/Your.app [/path/to/Your.dmg]" >&2
  exit 2
fi

if [[ ! -d "${APP_PATH}" || "${APP_PATH}" != *.app ]]; then
  echo "APP path must be a .app directory: ${APP_PATH}" >&2
  exit 2
fi

if [[ -n "${DMG_PATH}" ]]; then
  if [[ ! -f "${DMG_PATH}" || "${DMG_PATH}" != *.dmg ]]; then
    echo "DMG path must be a .dmg file: ${DMG_PATH}" >&2
    exit 2
  fi
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Install Xcode Command Line Tools." >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}" || true
}
trap cleanup EXIT

ZIP_PATH="${TMP_DIR}/app.zip"
LOG_PATH="${TMP_DIR}/notarytool.log"

# Auth selection: prefer App Store Connect API key if present.
AUTH_ARGS=()
if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
  KEY_P8="${TMP_DIR}/AuthKey.p8"
  echo "Using App Store Connect API key auth."
  echo "${APPLE_API_KEY}" | base64 --decode >"${KEY_P8}"
  chmod 600 "${KEY_P8}"
  AUTH_ARGS+=(--key "${KEY_P8}" --key-id "${APPLE_API_KEY_ID}" --issuer "${APPLE_API_ISSUER}")
else
  if [[ -z "${APPLE_ID:-}" || -z "${APPLE_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ]]; then
    cat >&2 <<'EOF'
Missing notarization credentials.

Provide either:
  - APPLE_API_KEY (base64-encoded .p8), APPLE_API_KEY_ID, APPLE_API_ISSUER
or:
  - APPLE_ID, APPLE_PASSWORD (app-specific password), APPLE_TEAM_ID
EOF
    exit 2
  fi
  echo "Using Apple ID auth."
  AUTH_ARGS+=(--apple-id "${APPLE_ID}" --password "${APPLE_PASSWORD}" --team-id "${APPLE_TEAM_ID}")
fi

echo "Diagnostics:"
sw_vers || true
xcodebuild -version || true
xcrun notarytool --version || true

echo "Preflight signature checks:"
codesign -dv --verbose=4 "${APP_PATH}" 2>&1 || true
codesign --verify --deep --strict --verbose=2 "${APP_PATH}" 2>&1 || true
spctl -a -vv --type exec "${APP_PATH}" 2>&1 || true

# Extract TeamIdentifier for sanity checks.
APP_TEAM_ID=$(codesign -dv --verbose=4 "${APP_PATH}" 2>&1 | awk -F= '/^TeamIdentifier=/{print $2}' | head -1 || true)
if [[ -n "${APP_TEAM_ID:-}" ]]; then
  echo "App TeamIdentifier: ${APP_TEAM_ID}"
fi

if [[ -n "${APPLE_TEAM_ID:-}" && -n "${APP_TEAM_ID:-}" && "${APPLE_TEAM_ID}" != "${APP_TEAM_ID}" ]]; then
  echo "WARNING: APPLE_TEAM_ID (${APPLE_TEAM_ID}) does not match app TeamIdentifier (${APP_TEAM_ID})." >&2
  echo "This often causes notarization authentication problems. Use the Team ID from your Developer account that matches the signing cert." >&2
fi

echo "Zipping app (ditto):"
ditto -c -k --sequesterRsrc --keepParent "${APP_PATH}" "${ZIP_PATH}"

echo "Submitting to Apple notary service (this may take a while):"
ATTEMPTS="${NOTARIZE_ATTEMPTS:-8}"
SLEEP_SECONDS=30
MAX_SLEEP=600

retryable_regex='(statusCode: Optional\(5[0-9]{2}\)|\b5[0-9]{2}\b|UNEXPECTED_ERROR|server exception|Internal Server Error|Service Unavailable|Gateway Timeout|timed out|Could not connect|network|temporarily unavailable|try again at a later time)'

for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "=== Notarization attempt ${attempt}/${ATTEMPTS} ==="
  ATTEMPT_LOG="${TMP_DIR}/notarytool-${attempt}.log"

  set +e
  xcrun notarytool submit "${ZIP_PATH}" "${AUTH_ARGS[@]}" --wait --timeout 25m 2>&1 | tee "${ATTEMPT_LOG}"
  submit_exit=${PIPESTATUS[0]}
  set -e

  SUBMISSION_ID=$(grep -Eo '(id:|id =)[[:space:]]*[0-9A-Fa-f-]+' "${ATTEMPT_LOG}" | head -1 | sed -E 's/^(id:|id =)[[:space:]]*//' || true)
  if [[ -n "${SUBMISSION_ID:-}" ]]; then
    echo "Submission id: ${SUBMISSION_ID}"
  fi

  if [[ $submit_exit -eq 0 ]] && grep -qi 'status: Accepted' "${ATTEMPT_LOG}"; then
    echo "Notarization accepted. Stapling..."
    xcrun stapler staple "${APP_PATH}"
    if [[ -n "${DMG_PATH}" ]]; then
      echo "Attempting to staple DMG (may lag behind app ticket propagation)..."
      dmg_stapled=false
      for s in 1 2 3; do
        if xcrun stapler staple "${DMG_PATH}"; then
          dmg_stapled=true
          break
        fi
        echo "DMG staple attempt ${s}/3 failed; retrying in 30s..." >&2
        sleep 30
      done

      if [[ "$dmg_stapled" != "true" ]]; then
        echo "WARNING: DMG stapling failed after retries; continuing (app is stapled)." >&2
      fi
    fi
    echo "Staple complete."
    exit 0
  fi

  echo "Notarytool exit code: ${submit_exit}" >&2
  echo "Notarytool output (last 120 lines):" >&2
  tail -120 "${ATTEMPT_LOG}" >&2 || true

  if [[ -n "${SUBMISSION_ID:-}" ]]; then
    echo "Attempting to fetch notary info/log..." >&2
    xcrun notarytool info "${SUBMISSION_ID}" "${AUTH_ARGS[@]}" 2>&1 || true
    xcrun notarytool log "${SUBMISSION_ID}" "${AUTH_ARGS[@]}" 2>&1 | tail -200 || true
  fi

  if grep -qEi "$retryable_regex" "${ATTEMPT_LOG}"; then
    echo "Transient Apple error detected." >&2
    if [[ "$attempt" -lt "$ATTEMPTS" ]]; then
      jitter=$((RANDOM % 15))
      sleep_for=$((SLEEP_SECONDS + jitter))
      echo "Retrying in ${sleep_for}s..." >&2
      sleep "$sleep_for"
      SLEEP_SECONDS=$((SLEEP_SECONDS * 2))
      if (( SLEEP_SECONDS > MAX_SLEEP )); then
        SLEEP_SECONDS=$MAX_SLEEP
      fi
      continue
    fi
    echo "Retries exhausted." >&2
    exit 1
  fi

  echo "Notarization failed with a non-retryable error." >&2
  exit 1
done

echo "Retries exhausted." >&2
exit 1
