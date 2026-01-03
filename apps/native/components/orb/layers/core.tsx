/**
 * CoreVoid Layer
 *
 * The absolute black center of the orb - the void that absorbs all light.
 * Uses a radial gradient to create a soft edge that fades into the liquid surface.
 */

import {
  Circle,
  RadialGradient,
  type SkPoint,
} from "@shopify/react-native-skia";

import { ALFRED_COLORS } from "../constants";

// ─── Types ───────────────────────────────────────────────────────────────────

type CoreVoidProps = {
  /** Center point of the void */
  center: SkPoint;
  /** Radius of the void */
  radius: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CoreVoid({ center, radius }: CoreVoidProps) {
  return (
    <Circle cx={center.x} cy={center.y} r={radius}>
      <RadialGradient
        c={center}
        colors={[
          "#000000", // Absolute black at center
          "#000000", // Maintain black through 60%
          `${ALFRED_COLORS.background}00`, // Fade to transparent at edge
        ]}
        positions={[0, 0.6, 1]}
        r={radius}
      />
    </Circle>
  );
}
