import {
  Canvas,
  Circle,
  Group,
  Line,
  Rect,
  vec,
} from "@shopify/react-native-skia";
import { useMemo, useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import type { WindowType } from "@/store/desktop.types";

import { useDesktopStore } from "@/store/desktop";
import { useMindscapeStore } from "@/store/mindscape";

function clamp(n: number, min: number, max: number) {
  if (n < min) {
    return min;
  }
  if (n > max) {
    return max;
  }
  return n;
}

export function MindscapeCanvas() {
  const { width, height } = useWindowDimensions();
  const nodes = useMindscapeStore((s) => s.nodes);
  const edges = useMindscapeStore((s) => s.edges);
  const activeEdgeIds = useMindscapeStore((s) => s.activeEdgeIds);
  const viewport = useMindscapeStore((s) => s.viewport);
  const setViewport = useMindscapeStore((s) => s.setViewport);
  const updateNode = useMindscapeStore((s) => s.updateNode);
  const selectNode = useMindscapeStore((s) => s.selectNode);
  const clearSelection = useMindscapeStore((s) => s.clearSelection);

  const setMode = useDesktopStore((s) => s.setMode);
  const focusWindow = useDesktopStore((s) => s.focusWindow);
  const openWindow = useDesktopStore((s) => s.openWindow);

  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartZoomRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const pendingViewportRef = useRef(viewport);

  const flushViewport = useMemo(
    () => (next: typeof viewport) => {
      pendingViewportRef.current = next;
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setViewport(pendingViewportRef.current);
      });
    },
    [setViewport]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          const v = useMindscapeStore.getState().viewport;
          panStartRef.current = { x: v.x, y: v.y };
        })
        .onUpdate((e) => {
          const v = useMindscapeStore.getState().viewport;
          flushViewport({
            ...v,
            x: panStartRef.current.x + e.translationX,
            y: panStartRef.current.y + e.translationY,
          });
        })
        .onFinalize(() => {
          setViewport(pendingViewportRef.current);
        }),
    [flushViewport, setViewport]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onBegin(() => {
          pinchStartZoomRef.current =
            useMindscapeStore.getState().viewport.zoom;
        })
        .onUpdate((e) => {
          const v = useMindscapeStore.getState().viewport;
          const next = clamp(pinchStartZoomRef.current * e.scale, 0.25, 3);
          flushViewport({ ...v, zoom: next });
        })
        .onFinalize(() => {
          setViewport(pendingViewportRef.current);
        }),
    [flushViewport, setViewport]
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => {
          // Convert screen -> world coords
          const wx = (e.x - viewport.x) / viewport.zoom;
          const wy = (e.y - viewport.y) / viewport.zoom;
          // Hit test nodes (simple radius)
          const hit = nodes.find((n) => {
            const dx = wx - n.position.x;
            const dy = wy - n.position.y;
            return dx * dx + dy * dy < 32 * 32;
          });
          if (!hit) {
            clearSelection();
            return;
          }
          selectNode(hit.id);

          const winId = hit.data.sourceWindowId;
          if (!winId) {
            return;
          }

          // If the originating window no longer exists (closed), reopen using the stored type.
          setMode("desktop");
          const existing = useDesktopStore
            .getState()
            .windows.some((w) => w.id === winId);
          if (existing) {
            focusWindow(winId);
            return;
          }
          const winType = (hit.data.entityType ?? "chat") as WindowType;
          const newId = openWindow(winType, { label: hit.data.label });
          updateNode(hit.id, { sourceWindowId: newId });
        }),
    [
      clearSelection,
      focusWindow,
      nodes,
      openWindow,
      selectNode,
      setMode,
      updateNode,
      viewport,
    ]
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(pan, pinch, tap),
    [pan, pinch, tap]
  );

  const gridDots = useMemo(() => {
    const dots: Array<{ x: number; y: number }> = [];
    const gap = 32;
    for (let x = 0; x < width; x += gap) {
      for (let y = 0; y < height; y += gap) {
        dots.push({ x, y });
      }
    }
    return dots;
  }, [width, height]);

  const minimap = useMemo(() => {
    const pad = 120;
    let minX = -pad;
    let minY = -pad;
    let maxX = pad;
    let maxY = pad;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x);
      maxY = Math.max(maxY, n.position.y);
    }
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);

    const viewLeft = -viewport.x / viewport.zoom;
    const viewTop = -viewport.y / viewport.zoom;
    const viewW = width / viewport.zoom;
    const viewH = height / viewport.zoom;

    return { minX, minY, worldW, worldH, viewLeft, viewTop, viewW, viewH };
  }, [height, nodes, viewport.x, viewport.y, viewport.zoom, width]);

  return (
    <View className="flex-1 bg-background">
      <GestureDetector gesture={gesture}>
        <Animated.View style={{ flex: 1 }}>
          <Canvas style={{ width, height }}>
            <Rect color="#0A0E14" height={height} width={width} x={0} y={0} />
            {gridDots.map((d) => (
              <Circle
                color="#1F2937"
                cx={d.x}
                cy={d.y}
                key={`${d.x}_${d.y}`}
                r={1}
              />
            ))}

            <Group
              transform={[
                { translateX: viewport.x },
                { translateY: viewport.y },
                { scale: viewport.zoom },
              ]}
            >
              {edges.map((e) => {
                const a = nodes.find((n) => n.id === e.source);
                const b = nodes.find((n) => n.id === e.target);
                if (!(a && b)) {
                  return null;
                }
                const isActive = activeEdgeIds.includes(e.id);
                return (
                  <Line
                    color={isActive ? "#f97316" : "#22d3ee"}
                    key={e.id}
                    p1={vec(a.position.x, a.position.y)}
                    p2={vec(b.position.x, b.position.y)}
                    strokeWidth={isActive ? 4 : 2}
                  />
                );
              })}

              {nodes.map((n) => (
                <Circle
                  color={n.data.type === "concept" ? "#22d3ee" : "#a78bfa"}
                  cx={n.position.x}
                  cy={n.position.y}
                  key={n.id}
                  r={24}
                />
              ))}
            </Group>
          </Canvas>

          {/* Minimap overlay */}
          <View className="absolute top-4 right-4 overflow-hidden rounded-lg border border-border bg-background/80">
            <Canvas style={{ width: 140, height: 100 }}>
              <Rect color="#0B1220" height={100} width={140} x={0} y={0} />

              {nodes.map((n) => {
                const x =
                  ((n.position.x - minimap.minX) / minimap.worldW) * 140;
                const y =
                  ((n.position.y - minimap.minY) / minimap.worldH) * 100;
                return (
                  <Circle
                    color={n.data.type === "concept" ? "#22d3ee" : "#a78bfa"}
                    cx={x}
                    cy={y}
                    key={`mm_${n.id}`}
                    r={3}
                  />
                );
              })}
              {(() => {
                const x0 =
                  ((minimap.viewLeft - minimap.minX) / minimap.worldW) * 140;
                const y0 =
                  ((minimap.viewTop - minimap.minY) / minimap.worldH) * 100;
                const w0 = (minimap.viewW / minimap.worldW) * 140;
                const h0 = (minimap.viewH / minimap.worldH) * 100;
                const x1 = x0 + w0;
                const y1 = y0 + h0;
                return (
                  <>
                    <Line
                      color="#22d3ee"
                      p1={vec(x0, y0)}
                      p2={vec(x1, y0)}
                      strokeWidth={2}
                    />
                    <Line
                      color="#22d3ee"
                      p1={vec(x1, y0)}
                      p2={vec(x1, y1)}
                      strokeWidth={2}
                    />
                    <Line
                      color="#22d3ee"
                      p1={vec(x1, y1)}
                      p2={vec(x0, y1)}
                      strokeWidth={2}
                    />
                    <Line
                      color="#22d3ee"
                      p1={vec(x0, y1)}
                      p2={vec(x0, y0)}
                      strokeWidth={2}
                    />
                  </>
                );
              })()}
            </Canvas>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
