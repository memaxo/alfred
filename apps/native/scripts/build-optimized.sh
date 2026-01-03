#!/bin/bash
# Optimized Build Script for Alfred iOS App
# Uses all available xcodebuild optimizations for fastest builds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKSPACE="Alfred.xcworkspace"
SCHEME="Alfred"
CONFIGURATION="Debug"
SIMULATOR_NAME="iPhone 17 Pro"
BUNDLE_ID="com.alfred.app"
DERIVED_DATA_PATH="$(pwd)/build/DerivedData"

# Parse arguments
CLEAN_BUILD=false
VERBOSE=false
INSTALL=true
LAUNCH=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --clean)
      CLEAN_BUILD=true
      shift
      ;;
    --no-install)
      INSTALL=false
      shift
      ;;
    --no-launch)
      LAUNCH=false
      shift
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --release)
      CONFIGURATION="Release"
      shift
      ;;
    --device)
      SIMULATOR_NAME="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --clean        Clean build (removes derived data)"
      echo "  --no-install   Build only, don't install on simulator"
      echo "  --no-launch    Don't launch after install"
      echo "  --verbose, -v  Show full xcodebuild output"
      echo "  --release      Build Release configuration"
      echo "  --device NAME  Specify simulator device (default: iPhone 15 Pro)"
      echo "  --help, -h     Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

cd "$(dirname "$0")/.."

# Step -1: Apply required patches for native dependencies
if [ -f "scripts/apply-patches.sh" ]; then
  ./scripts/apply-patches.sh
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🚀 Alfred iOS Optimized Build${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Configuration: ${YELLOW}$CONFIGURATION${NC}"
echo -e "  Target Device: ${YELLOW}$SIMULATOR_NAME${NC}"
echo -e "  Clean Build:   ${YELLOW}$CLEAN_BUILD${NC}"
echo ""

# Step 0: Check SDK and Runtime compatibility
echo -e "${GREEN}🔍 Checking Xcode SDK and Runtime compatibility...${NC}"
SDK_VERSION=$(xcodebuild -showsdks 2>/dev/null | grep "iOS.*iphonesimulator" | head -1 | grep -oE "[0-9]+\.[0-9]+")
AVAILABLE_RUNTIMES=$(xcrun simctl list runtimes 2>/dev/null | grep "iOS" | grep -oE "iOS [0-9]+\.[0-9]+" | sed 's/iOS //' | tr '\n' ' ')

echo "  SDK Version: $SDK_VERSION"
echo "  Available Runtimes: $AVAILABLE_RUNTIMES"

if ! echo "$AVAILABLE_RUNTIMES" | grep -q "$SDK_VERSION"; then
  echo ""
  echo -e "${YELLOW}⚠️  Warning: iOS $SDK_VERSION runtime not found!${NC}"
  echo -e "  Your Xcode SDK ($SDK_VERSION) requires matching simulator runtime."
  echo ""
  echo "  Options:"
  echo "    1. Install iOS $SDK_VERSION runtime: xcodebuild -downloadPlatform iOS"
  echo "    2. Use Expo dev server (no native build): npx expo start"
  echo ""
  
  # Check if download is in progress
  if pgrep -f "downloadPlatform iOS" > /dev/null; then
    echo -e "${BLUE}  📥 iOS runtime download in progress...${NC}"
    echo "     Check: tail -f /tmp/ios-download.log"
    echo ""
  fi
  
  # Try to find closest available runtime
  CLOSEST_RUNTIME=$(echo "$AVAILABLE_RUNTIMES" | tr ' ' '\n' | grep -E "^[0-9]" | sort -V | tail -1)
  if [ -n "$CLOSEST_RUNTIME" ]; then
    echo "  Attempting build with closest runtime: iOS $CLOSEST_RUNTIME"
    SIMULATOR_NAME=$(xcrun simctl list devices "iOS $CLOSEST_RUNTIME" | grep -E "iPhone|iPad" | head -1 | sed 's/.*(\([A-F0-9-]*\)).*/\1/' | head -1)
    if [ -z "$SIMULATOR_NAME" ]; then
      echo -e "${RED}❌ No compatible simulator found. Please install iOS $SDK_VERSION runtime.${NC}"
      exit 1
    fi
    # Get device name for the UDID
    SIMULATOR_NAME=$(xcrun simctl list devices | grep "$SIMULATOR_NAME" | head -1 | sed 's/^ *//;s/ (.*//')
    echo "  Using simulator: $SIMULATOR_NAME"
  fi
fi

echo ""

# Step 1: Ensure simulator is booted
echo -e "${GREEN}📱 Checking simulator...${NC}"
BOOTED_UDID=$(xcrun simctl list devices | grep "$SIMULATOR_NAME" | grep "Booted" | grep -oE "[A-F0-9-]{36}" | head -1)

if [ -z "$BOOTED_UDID" ]; then
  SIMULATOR_UDID=$(xcrun simctl list devices | grep "$SIMULATOR_NAME" | grep -oE "[A-F0-9-]{36}" | head -1)
  if [ -z "$SIMULATOR_UDID" ]; then
    echo -e "${RED}❌ Simulator '$SIMULATOR_NAME' not found${NC}"
    exit 1
  fi
  echo "Booting simulator..."
  xcrun simctl boot "$SIMULATOR_UDID" 2>/dev/null || true
  open -a Simulator
  sleep 3
  BOOTED_UDID="$SIMULATOR_UDID"
else
  echo -e "  Simulator already booted: ${GREEN}$BOOTED_UDID${NC}"
fi

# Step 2: Clean if requested
if [ "$CLEAN_BUILD" = true ]; then
  echo ""
  echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
  rm -rf "$DERIVED_DATA_PATH"
  rm -rf ios/build
fi

# Step 3: Create derived data directory
mkdir -p "$DERIVED_DATA_PATH"

# Step 4: Build with optimizations
echo ""
echo -e "${GREEN}🔨 Building with optimizations...${NC}"
echo ""

cd ios

# Determine build action
BUILD_ACTION="build"
if [ "$CLEAN_BUILD" = true ]; then
  BUILD_ACTION="clean build"
fi

# Check if xcbeautify is available
FORMATTER=""
if command -v xcbeautify &> /dev/null; then
  FORMATTER="xcbeautify"
elif command -v xcpretty &> /dev/null; then
  FORMATTER="xcpretty"
fi

# Build command with all optimizations
# Use the booted simulator's UDID for destination
BUILD_CMD="xcodebuild \
  -workspace $WORKSPACE \
  -scheme $SCHEME \
  -configuration $CONFIGURATION \
  -sdk iphonesimulator \
  -destination 'id=$BOOTED_UDID' \
  -derivedDataPath '$DERIVED_DATA_PATH' \
  -parallelizeTargets \
  ONLY_ACTIVE_ARCH=YES \
  DEBUG_INFORMATION_FORMAT=dwarf \
  COMPILER_INDEX_STORE_ENABLE=NO \
  CODE_SIGN_IDENTITY='' \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  SWIFT_ENABLE_COMPILE_CACHE=YES \
  CLANG_ENABLE_COMPILE_CACHE=YES \
  SWIFT_ENABLE_EXPLICIT_MODULES=YES \
  CLANG_ENABLE_MODULES=YES \
  SWIFT_USE_INTEGRATED_DRIVER=YES \
  GCC_OPTIMIZATION_LEVEL=0 \
  SWIFT_OPTIMIZATION_LEVEL=-Onone \
  $BUILD_ACTION"

# Time the build
START_TIME=$(date +%s)

if [ "$VERBOSE" = true ]; then
  eval "$BUILD_CMD"
elif [ -n "$FORMATTER" ]; then
  eval "$BUILD_CMD" 2>&1 | $FORMATTER
else
  eval "$BUILD_CMD" 2>&1 | grep -E "(Compiling|Linking|Building|error:|warning:|✓|✗)" || true
fi

BUILD_RESULT=${PIPESTATUS[0]}
END_TIME=$(date +%s)
BUILD_DURATION=$((END_TIME - START_TIME))

cd ..

if [ $BUILD_RESULT -ne 0 ]; then
  echo ""
  echo -e "${RED}❌ Build failed after ${BUILD_DURATION}s${NC}"
  echo "Run with --verbose to see full output"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Build completed in ${BUILD_DURATION}s${NC}"

# Step 5: Install on simulator
if [ "$INSTALL" = true ]; then
  echo ""
  echo -e "${GREEN}📦 Installing on simulator...${NC}"
  
  # Find the built app in derived data (use /usr/bin/find to avoid fd alias)
  APP_PATH=$(/usr/bin/find "$DERIVED_DATA_PATH" -name "Alfred.app" -type d 2>/dev/null | head -1)
  
  if [ -z "$APP_PATH" ]; then
    # Try the default build location
    APP_PATH=$(/usr/bin/find ios/build -name "Alfred.app" -type d 2>/dev/null | head -1)
  fi
  
  if [ -z "$APP_PATH" ]; then
    echo -e "${RED}❌ Could not find built app${NC}"
    echo "Looking in: $DERIVED_DATA_PATH"
    exit 1
  fi
  
  echo "  App path: $APP_PATH"
  xcrun simctl install booted "$APP_PATH"
  echo -e "${GREEN}  ✅ Installed${NC}"
fi

# Step 6: Launch app
if [ "$LAUNCH" = true ] && [ "$INSTALL" = true ]; then
  echo ""
  echo -e "${GREEN}🚀 Launching app...${NC}"
  xcrun simctl launch booted "$BUNDLE_ID"
  echo -e "${GREEN}  ✅ Launched${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Build Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Build time: ${BUILD_DURATION}s"
echo "  Derived data: $DERIVED_DATA_PATH"
echo ""
echo "Quick commands:"
echo "  Re-run:    $0"
echo "  Clean:     $0 --clean"
echo "  Launch:    xcrun simctl launch booted $BUNDLE_ID"
echo "  Logs:      xcrun simctl spawn booted log stream --predicate 'subsystem == \"$BUNDLE_ID\"'"
echo ""
