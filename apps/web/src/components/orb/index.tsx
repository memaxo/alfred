"use client";

/**
 * Orb Component - AI Presence Indicator
 *
 * Visual feedback for ALFRED's cognitive state and voice activity.
 *
 * Features:
 * - 5 states: idle, listening, thinking, talking, active
 * - Docked, floating, and expanded modes
 * - GPU-accelerated animations
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 4.4
 */

import { useOrbStore } from "@/store/orb";

import { DockedOrb } from "./docked";
import { ExpandedOrb } from "./expanded";
import { FloatingOrb } from "./floating";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Orb() {
  const mode = useOrbStore((s) => s.mode);

  if (mode === "hidden") {
    return null;
  }

  if (mode === "expanded") {
    return <ExpandedOrb />;
  }

  if (mode === "floating") {
    return <FloatingOrb />;
  }

  return <DockedOrb />;
}

export { OrbCore } from "./core";
export { DockedOrb } from "./docked";
export { ExpandedOrb } from "./expanded";
export { FloatingOrb } from "./floating";
export { QuickActions } from "./quick-actions";
