import {
  Canvas,
  Rect,
  Turbulence,
  Fill,
  Blur,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

interface NoiseOverlayProps {
  opacity?: number;
}

export function NoiseOverlay({ opacity = 0.02 }: NoiseOverlayProps) {
  const seed = useMemo(() => Math.random() * 100, []);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={1000} height={2000}>
          <Turbulence freqX={0.8} freqY={0.8} octaves={4} seed={seed} />
        </Rect>
        <Fill color="rgba(255, 255, 255, 0.5)">
          <Blur blur={0.5} />
        </Fill>
      </Canvas>
    </View>
  );
}

export default NoiseOverlay;
