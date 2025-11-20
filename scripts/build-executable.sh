#!/bin/bash
# ALFRED Executable Build Script
# Builds a standalone Bun executable for Proxmox deployment

set -euo pipefail

# Configuration
ENTRY_POINT="${ENTRY_POINT:-apps/web/src/server.ts}"
OUTPUT_FILE="${OUTPUT_FILE:-dist/alfred-server}"
TARGET="${TARGET:-bun-linux-x64}"
MINIFY="${MINIFY:-true}"
SOURCEMAP="${SOURCEMAP:-true}"
BYTECODE="${BYTECODE:-false}"

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

