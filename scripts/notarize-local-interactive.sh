#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-}"
DMG_PATH="${2:-}"

if [[ -z "${APP_PATH}" ]]; then
  echo "Usage: scripts/notarize-local-interactive.sh /path/to/Your.app [/path/to/Your.dmg]" >&2
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

# Help the user avoid Team ID typos by extracting it from the signed app.
APP_TEAM_ID=$(codesign -dv --verbose=4 "${APP_PATH}" 2>&1 | awk -F= '/^TeamIdentifier=/{print $2}' | head -1 || true)

# Prefer API key if already present in env; otherwise prompt Apple ID flow.
if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
  echo "Using existing App Store Connect API key env vars (APPLE_API_KEY*)."
else
  echo "Enter Apple notarization credentials (inputs are not echoed)."
  if [[ -z "${APPLE_ID:-}" ]]; then
    while true; do
      read -r -p "APPLE_ID (email): " APPLE_ID
      [[ -n "${APPLE_ID}" ]] && break
    done
    export APPLE_ID
  fi

  if [[ -z "${APPLE_TEAM_ID:-}" ]]; then
    while true; do
      if [[ -n "${APP_TEAM_ID:-}" ]]; then
        read -r -p "APPLE_TEAM_ID [${APP_TEAM_ID}]: " APPLE_TEAM_ID
        APPLE_TEAM_ID="${APPLE_TEAM_ID:-$APP_TEAM_ID}"
      else
        read -r -p "APPLE_TEAM_ID (e.g. 7W2S4M7JZM): " APPLE_TEAM_ID
      fi
      [[ -n "${APPLE_TEAM_ID}" ]] && break
    done
    export APPLE_TEAM_ID
  fi

  if [[ -z "${APPLE_PASSWORD:-}" ]]; then
    while true; do
      read -r -s -p "APPLE_PASSWORD (app-specific password): " APPLE_PASSWORD
      echo
      [[ -n "${APPLE_PASSWORD}" ]] && break
    done
    export APPLE_PASSWORD
  fi
fi

exec "$(dirname "$0")/notarize-local.sh" "${APP_PATH}" "${DMG_PATH:-}"
