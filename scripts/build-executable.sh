#!/bin/bash
# ALFRED Executable Build Script
# Builds a standalone Bun executable for Proxmox deployment

set -euo pipefail

# Configuration
ENTRY_POINT="${ENTRY_POINT:-apps/web/src/exe.ts}"
OUTPUT_FILE="${OUTPUT_FILE:-dist/alfred-server}"
TARGET="${TARGET:-bun-linux-x64}"
MINIFY="${MINIFY:-true}"
SOURCEMAP="${SOURCEMAP:-true}"
BYTECODE="${BYTECODE:-false}"
NODE_ENV="${NODE_ENV:-production}"
# Feature flags for bun:bundle dead code elimination (comma-separated)
FEATURES="${FEATURES:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building ALFRED executable...${NC}"

# Check if entry point exists
if [ ! -f "$ENTRY_POINT" ]; then
  echo -e "${RED}Error: Entry point not found: $ENTRY_POINT${NC}"
  exit 1
fi

# Ensure dist directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Extract build-time constants
# Get version from package.json or git describe
if [ -f "package.json" ]; then
  BUILD_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
else
  BUILD_VERSION="unknown"
fi

# Try git describe for version if available
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  GIT_VERSION=$(git describe --tags --always 2>/dev/null || echo "$BUILD_VERSION")
  if [ "$GIT_VERSION" != "$BUILD_VERSION" ] && [ "$GIT_VERSION" != "unknown" ]; then
    BUILD_VERSION="$GIT_VERSION"
  fi
fi

# Get build timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get git commit and branch
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
else
  GIT_COMMIT="unknown"
  GIT_BRANCH="unknown"
fi

# Build command
BUILD_CMD="bun build --compile --target=$TARGET"

if [ "$MINIFY" = "true" ]; then
  BUILD_CMD="$BUILD_CMD --minify"
fi

if [ "$SOURCEMAP" = "true" ]; then
  BUILD_CMD="$BUILD_CMD --sourcemap"
fi

if [ "$BYTECODE" = "true" ]; then
  BUILD_CMD="$BUILD_CMD --bytecode"
fi

# Inject build-time constants via --define flags
# Values must be JSON-quoted strings
BUILD_CMD="$BUILD_CMD --define BUILD_VERSION='\"$BUILD_VERSION\"'"
BUILD_CMD="$BUILD_CMD --define BUILD_TIME='\"$BUILD_TIME\"'"
BUILD_CMD="$BUILD_CMD --define GIT_COMMIT='\"$GIT_COMMIT\"'"
BUILD_CMD="$BUILD_CMD --define GIT_BRANCH='\"$GIT_BRANCH\"'"
BUILD_CMD="$BUILD_CMD --define NODE_ENV='\"$NODE_ENV\"'"
BUILD_CMD="$BUILD_CMD --define BUILD_TARGET='\"$TARGET\"'"

# Add feature flags for bun:bundle dead code elimination
if [ -n "$FEATURES" ]; then
  IFS=',' read -ra FEATURE_ARRAY <<< "$FEATURES"
  for feature in "${FEATURE_ARRAY[@]}"; do
    feature=$(echo "$feature" | xargs) # trim whitespace
    if [ -n "$feature" ]; then
      BUILD_CMD="$BUILD_CMD --feature=$feature"
    fi
  done
fi

BUILD_CMD="$BUILD_CMD $ENTRY_POINT --outfile $OUTPUT_FILE"

echo -e "${YELLOW}Running: $BUILD_CMD${NC}"
eval "$BUILD_CMD"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Build successful!${NC}"
  echo -e "${GREEN}Executable: $OUTPUT_FILE${NC}"
  
  # Show file size
  if [ -f "$OUTPUT_FILE" ]; then
    SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "${GREEN}Size: $SIZE${NC}"
  fi
else
  echo -e "${RED}✗ Build failed!${NC}"
  exit 1
fi

