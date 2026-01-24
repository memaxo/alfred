#!/bin/bash
# Generate splash screen variants from source logo
# Usage: ./generate-splash.sh <logo.png>
# Creates splash screens for various device sizes

set -e

SOURCE="${1:-assets/icon-source.png}"
ASSETS_DIR="assets"
SPLASH_DIR="$ASSETS_DIR/splash"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source image not found: $SOURCE"
    echo "Please save the ALFRED logo as: $SOURCE"
    exit 1
fi

echo "Generating splash screens from: $SOURCE"

mkdir -p "$SPLASH_DIR"

# Background color (void theme dark)
BG_COLOR="#0A0A0F"

# Function to create splash with centered logo
create_splash() {
    local width=$1
    local height=$2
    local logo_size=$3
    local output=$4
    
    # Create background
    local temp_bg="/tmp/splash_bg_${width}x${height}.png"
    sips -z $height $width "$SOURCE" --out "$temp_bg" 2>/dev/null || true
    
    # For now, just resize the logo to fit splash dimensions
    # The logo will be centered by Expo's splash config
    sips -z $logo_size $logo_size "$SOURCE" --out "$output"
    
    echo "✓ $output (${width}x${height}, logo: ${logo_size}px)"
}

# Main splash (used by Expo, resized automatically)
# Expo expects a splash image that it will resize/position
sips -z 1284 2778 "$SOURCE" --out "$ASSETS_DIR/splash.png" 2>/dev/null || \
    cp "$SOURCE" "$ASSETS_DIR/splash.png"
echo "✓ splash.png (main)"

# Device-specific splash screens (optional)
# iPhone SE / 8 (750x1334)
create_splash 750 1334 200 "$SPLASH_DIR/splash-750x1334.png"

# iPhone 12/13/14 (1170x2532)
create_splash 1170 2532 300 "$SPLASH_DIR/splash-1170x2532.png"

# iPhone 14 Pro Max (1290x2796)
create_splash 1290 2796 320 "$SPLASH_DIR/splash-1290x2796.png"

# iPhone 15 Pro Max (1179x2556)
create_splash 1179 2556 300 "$SPLASH_DIR/splash-1179x2556.png"

# iPad Pro 11" (1668x2388)
create_splash 1668 2388 400 "$SPLASH_DIR/splash-1668x2388.png"

# iPad Pro 12.9" (2048x2732)
create_splash 2048 2732 500 "$SPLASH_DIR/splash-2048x2732.png"

echo ""
echo "Done! Splash screens generated in $SPLASH_DIR/"
echo ""
echo "Note: Update app.json splash config to use these assets"
