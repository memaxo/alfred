#!/bin/bash
# Generate app icons from source image
# Usage: ./generate-icons.sh <source-image.png>
# Source image should be 1024x1024 or larger

set -e

SOURCE="${1:-assets/icon-source.png}"
ASSETS_DIR="assets"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source image not found: $SOURCE"
    echo "Please save the ALFRED logo as: $SOURCE"
    exit 1
fi

echo "Generating icons from: $SOURCE"

# Main app icon (1024x1024)
sips -z 1024 1024 "$SOURCE" --out "$ASSETS_DIR/icon.png"
echo "✓ icon.png (1024x1024)"

# Adaptive icon for Android (1024x1024)
cp "$ASSETS_DIR/icon.png" "$ASSETS_DIR/adaptive-icon.png"
echo "✓ adaptive-icon.png (1024x1024)"

# Notification icon (96x96)
sips -z 96 96 "$SOURCE" --out "$ASSETS_DIR/notification-icon.png"
echo "✓ notification-icon.png (96x96)"

# Favicon (32x32)
sips -z 32 32 "$SOURCE" --out "$ASSETS_DIR/favicon.png"
echo "✓ favicon.png (32x32)"

# iOS specific sizes (optional, EAS handles these)
mkdir -p "$ASSETS_DIR/icons"
sips -z 180 180 "$SOURCE" --out "$ASSETS_DIR/icons/icon-180.png"  # iPhone @3x
sips -z 120 120 "$SOURCE" --out "$ASSETS_DIR/icons/icon-120.png"  # iPhone @2x
sips -z 167 167 "$SOURCE" --out "$ASSETS_DIR/icons/icon-167.png"  # iPad Pro @2x
sips -z 152 152 "$SOURCE" --out "$ASSETS_DIR/icons/icon-152.png"  # iPad @2x
sips -z 76 76 "$SOURCE" --out "$ASSETS_DIR/icons/icon-76.png"     # iPad @1x
sips -z 40 40 "$SOURCE" --out "$ASSETS_DIR/icons/icon-40.png"     # Spotlight @2x
sips -z 29 29 "$SOURCE" --out "$ASSETS_DIR/icons/icon-29.png"     # Settings @1x
echo "✓ iOS icon variants"

echo ""
echo "Done! All icons generated in $ASSETS_DIR/"
