#!/usr/bin/env bash
# generate-icons.sh — Generate all required Tauri app icons from a source SVG
# Requires: rsvg-convert (librsvg) or sips (macOS built-in)
#
# Usage: ./scripts/generate-icons.sh [source.svg]

set -euo pipefail

SOURCE="${1:-src-tauri/icons/icon.svg}"
ICON_DIR="src-tauri/icons"

if [ ! -f "$SOURCE" ]; then
  echo "Error: Source icon not found: $SOURCE"
  exit 1
fi

mkdir -p "$ICON_DIR"

# Check for rsvg-convert
if command -v rsvg-convert &>/dev/null; then
  CONVERTER="rsvg"
elif command -v sips &>/dev/null; then
  CONVERTER="sips"
else
  echo "Error: Neither rsvg-convert nor sips found."
  echo "Install librsvg: brew install librsvg"
  exit 1
fi

convert_svg() {
  local size=$1
  local output=$2

  if [ "$CONVERTER" = "rsvg" ]; then
    rsvg-convert -w "$size" -h "$size" "$SOURCE" -o "$output"
  else
    # sips can't handle SVG directly, need intermediate PNG
    echo "Warning: sips cannot convert SVG. Use rsvg-convert instead."
    echo "  brew install librsvg"
    return 1
  fi
}

# Generate PNG icons at required sizes
SIZES=(32 128 256 512)

for size in "${SIZES[@]}"; do
  output="$ICON_DIR/${size}x${size}.png"
  echo "Generating ${size}x${size}..."
  convert_svg "$size" "$output"
done

# Generate @2x variants
convert_svg 64 "$ICON_DIR/32x32@2x.png"
convert_svg 256 "$ICON_DIR/128x128@2x.png"

# Generate icon.png (the main app icon, 512x512)
convert_svg 512 "$ICON_DIR/icon.png"

# Generate .icns for macOS using iconutil
ICONSET_DIR="$ICON_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

for size in 16 32 128 256 512; do
  convert_svg "$size" "$ICONSET_DIR/icon_${size}x${size}.png"
  double=$((size * 2))
  if [ "$double" -le 1024 ]; then
    convert_svg "$double" "$ICONSET_DIR/icon_${size}x${size}@2x.png"
  fi
done

if command -v iconutil &>/dev/null; then
  iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"
  echo "Generated icon.icns"
  rm -rf "$ICONSET_DIR"
else
  echo "Warning: iconutil not found (macOS only). Skipping .icns generation."
fi

echo "Done! Icons generated in $ICON_DIR"
