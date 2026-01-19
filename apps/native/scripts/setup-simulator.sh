#!/usr/bin/env bash
set -euo pipefail

# Alfred simulator setup helper (repeatable local QA)
#
# Defaults:
# - iOS runtime: iOS 26.2
# - Device: iPhone 17 Pro
#
# Usage:
#   ./scripts/setup-simulator.sh            # boot default iPhone sim
#   ./scripts/setup-simulator.sh --ipad     # boot default iPad sim
#   ./scripts/setup-simulator.sh --dark     # set dark appearance
#   ./scripts/setup-simulator.sh --erase    # erase then boot

RUNTIME_NAME="iOS 26.2"
IPHONE_NAME="iPhone 17 Pro"
IPAD_NAME="iPad Pro 13-inch (M5)"

DEVICE_NAME="$IPHONE_NAME"
APPEARANCE=""
ERASE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iphone)
      DEVICE_NAME="$IPHONE_NAME"
      shift
      ;;
    --ipad)
      DEVICE_NAME="$IPAD_NAME"
      shift
      ;;
    --dark)
      APPEARANCE="dark"
      shift
      ;;
    --light)
      APPEARANCE="light"
      shift
      ;;
    --erase)
      ERASE=1
      shift
      ;;
    --runtime)
      RUNTIME_NAME="${2:?missing runtime name}"
      shift 2
      ;;
    --device)
      DEVICE_NAME="${2:?missing device name}"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--iphone|--ipad] [--dark|--light] [--erase] [--runtime \"iOS 26.2\"] [--device \"iPhone 17 Pro\"]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

UDID="$(xcrun simctl list devices "$RUNTIME_NAME" 2>/dev/null | awk -v name="$DEVICE_NAME" '
  $0 ~ name {
    match($0, /\(([A-F0-9-]{36})\)/, m)
    if (m[1] != "") { print m[1]; exit }
  }
')"

if [[ -z "${UDID:-}" ]]; then
  echo "Could not find simulator '$DEVICE_NAME' for runtime '$RUNTIME_NAME'." >&2
  echo "Available devices for $RUNTIME_NAME:" >&2
  xcrun simctl list devices "$RUNTIME_NAME" >&2 || true
  exit 1
fi

if [[ "$ERASE" -eq 1 ]]; then
  xcrun simctl erase "$UDID" || true
fi

xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator || true

if [[ -n "$APPEARANCE" ]]; then
  xcrun simctl ui "$UDID" appearance "$APPEARANCE" || true
fi

echo "Simulator ready: $DEVICE_NAME ($RUNTIME_NAME) $UDID"

