import { useEffect, useMemo } from "react";
import { Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { useDesktopStore } from "@/store/desktop";
import type { WindowInstance } from "@/store/desktop.types";
import { WindowChrome } from "./chrome";
import { windowRegistry } from "./registry";

function clamp(n: number, min: number, max: number) {
  if (n < min) {
    return min;
  }
  if (n > max) {
    return max;
  }
  return n;
}

function WindowView({ window }: { window: WindowInstance }) {
  const closeWindow = useDesktopStore((s) => s.closeWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);
  const moveWindow = useDesktopStore((s) => s.moveWindow);
  const resizeWindow = useDesktopStore((s) => s.resizeWindow);
  const minimizeWindow = useDesktopStore((s) => s.minimizeWindow);
  const maximizeWindow = useDesktopStore((s) => s.maximizeWindow);
  const restoreWindow = useDesktopStore((s) => s.restoreWindow);

  const Component = useMemo(() => windowRegistry[window.type], [window.type]);

  const x = useSharedValue(window.bounds.x);
  const y = useSharedValue(window.bounds.y);
  const w = useSharedValue(window.bounds.width);
  const h = useSharedValue(window.bounds.height);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);

  useEffect(() => {
    x.value = window.bounds.x;
    y.value = window.bounds.y;
    w.value = window.bounds.width;
    h.value = window.bounds.height;
  }, [
    window.bounds.x,
    window.bounds.y,
    window.bounds.width,
    window.bounds.height,
    x,
    y,
    w,
    h,
  ]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startX.value = x.value;
          startY.value = y.value;
          runOnJS(focusWindow)(window.id);
        })
        .onUpdate((e) => {
          x.value = startX.value + e.translationX;
          y.value = startY.value + e.translationY;
        })
        .onEnd(() => {
          runOnJS(moveWindow)(window.id, { x: x.value, y: y.value });
        }),
    [focusWindow, moveWindow, window.id, startX, startY, x, y]
  );

  const resize = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startW.value = w.value;
          startH.value = h.value;
          runOnJS(focusWindow)(window.id);
        })
        .onUpdate((e) => {
          w.value = clamp(startW.value + e.translationX, 240, 900);
          h.value = clamp(startH.value + e.translationY, 240, 900);
        })
        .onEnd(() => {
          runOnJS(resizeWindow)(window.id, { width: w.value, height: h.value });
        }),
    [focusWindow, resizeWindow, startH, startW, window.id, w, h]
  );

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    zIndex: window.zIndex,
  }));

  return (
    <Animated.View style={style}>
      <GestureDetector gesture={drag}>
        <Animated.View style={{ flex: 1 }}>
          <WindowChrome
            isFocused={window.isFocused}
            isMaximized={window.state === "maximized"}
            onClose={() => closeWindow(window.id)}
            onMaximize={() => maximizeWindow(window.id)}
            onMinimize={() => minimizeWindow(window.id)}
            onRestore={() => restoreWindow(window.id)}
            title={window.data.label ?? window.type}
          >
            <Component
              onClose={() => closeWindow(window.id)}
              onFocus={() => focusWindow(window.id)}
              onMaximize={() => maximizeWindow(window.id)}
              onMinimize={() => minimizeWindow(window.id)}
              onRestore={() => restoreWindow(window.id)}
              window={window}
            />
            <GestureDetector gesture={resize}>
              <Animated.View
                style={{
                  position: "absolute",
                  right: 6,
                  bottom: 6,
                  width: 24,
                  height: 24,
                }}
              >
                <Text className="text-muted-foreground text-xs">↘︎</Text>
              </Animated.View>
            </GestureDetector>
          </WindowChrome>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export function WindowLayer() {
  const windows = useDesktopStore((s) => s.windows);

  return (
    <>
      {windows
        .filter((w) => w.state !== "minimized")
        .map((w) => (
          <WindowView key={w.id} window={w} />
        ))}
    </>
  );
}
