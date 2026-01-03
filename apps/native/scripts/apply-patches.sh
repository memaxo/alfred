#!/bin/bash
# Apply iOS build patches for native dependencies
set -e

cd "$(dirname "$0")/.."
PATCHES_DIR="$(pwd)/patches"
NODE_MODULES="$(pwd)/../../node_modules"

echo "Applying iOS build patches..."

# Patch react-native-carplay Swift bridging header import
CARPLAY_FILE="$NODE_MODULES/@g4rb4g3/react-native-carplay/ios/RNCarPlay.m"
if [ -f "$CARPLAY_FILE" ]; then
  if grep -q '#import "react_native_carplay/react_native_carplay-Swift.h"' "$CARPLAY_FILE"; then
    echo "  Patching react-native-carplay..."
    sed -i '' 's|#import "react_native_carplay/react_native_carplay-Swift.h"|#if __has_include(<react_native_carplay/react_native_carplay-Swift.h>)\
#import <react_native_carplay/react_native_carplay-Swift.h>\
#else\
#import "react_native_carplay-Swift.h"\
#endif|' "$CARPLAY_FILE"
    echo "    ✓ react-native-carplay patched"
  else
    echo "    ✓ react-native-carplay already patched"
  fi
fi

# Patch expo-file-system to use ExpoAppDelegateSubscriberRepository instead of ExpoAppDelegate
FILESYSTEM_FILE="$NODE_MODULES/expo-file-system/ios/FileSystemModule.swift"
if [ -f "$FILESYSTEM_FILE" ]; then
  if grep -q "ExpoAppDelegate.getSubscriberOfType" "$FILESYSTEM_FILE"; then
    echo "  Patching expo-file-system..."
    sed -i '' 's/ExpoAppDelegate.getSubscriberOfType/ExpoAppDelegateSubscriberRepository.getSubscriberOfType/' "$FILESYSTEM_FILE"
    echo "    ✓ expo-file-system patched"
  else
    echo "    ✓ expo-file-system already patched"
  fi
fi

echo "✅ All patches applied"
