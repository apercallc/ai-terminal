#!/usr/bin/env bash
# version-bump.sh — Bump version across package.json, Cargo.toml, and tauri.conf.json
#
# Usage:
#   ./scripts/version-bump.sh <major|minor|patch>
#   ./scripts/version-bump.sh 1.2.3

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Get current version from package.json
CURRENT=$(node -e "console.log(require('$ROOT_DIR/package.json').version)")
echo "Current version: $CURRENT"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

# Determine new version
case "${1:-}" in
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
    ;;
  patch)
    NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    ;;
  [0-9]*)
    NEW_VERSION="$1"
    ;;
  *)
    echo "Usage: $0 <major|minor|patch|x.y.z>"
    exit 1
    ;;
esac

echo "New version: $NEW_VERSION"

# Update package.json
cd "$ROOT_DIR"
npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version

# Update Cargo.toml
CARGO="$ROOT_DIR/src-tauri/Cargo.toml"
if [ -f "$CARGO" ]; then
  sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" "$CARGO"
  echo "Updated Cargo.toml"
fi

# Update tauri.conf.json
TAURI_CONF="$ROOT_DIR/src-tauri/tauri.conf.json"
if [ -f "$TAURI_CONF" ]; then
  # Use node for reliable JSON editing
  node -e "
    const fs = require('fs');
    const conf = JSON.parse(fs.readFileSync('$TAURI_CONF', 'utf8'));
    conf.version = '$NEW_VERSION';
    fs.writeFileSync('$TAURI_CONF', JSON.stringify(conf, null, 2) + '\n');
  "
  echo "Updated tauri.conf.json"
fi

echo ""
echo "Version bumped to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  git add -A"
echo "  git commit -m 'chore: bump version to $NEW_VERSION'"
echo "  git tag v$NEW_VERSION"
echo "  git push && git push --tags"
