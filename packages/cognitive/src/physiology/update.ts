/**
 * Physiology update logic
 */

import { performance } from "node:perf_hooks";

import { cognitivePhysiologyUpdateDuration } from "../metrics.js";
import { clamp01 } from "../util/math.js";
import type { Physiology, PhysiologyEvent } from "./types.js";

export const defaultPhysiology = (): Physiology => ({
  energy: 1.0,
  boredom: 0.0,
  frustration: 0.0,
});

export const updatePhysiology = (
  current: Physiology,
  event: PhysiologyEvent
): Physiology => {
  const start = performance.now();
  try {
    let { energy, boredom, frustration } = current;

    switch (event) {
      case "step":
        energy -= 0.01;
        break;
      case "success":
        frustration *= 0.5;
        energy += 0.05;
        boredom *= 0.9;
        break;
      case "error":
        frustration += 0.2;
        energy -= 0.05;
        break;
      case "entropy_high":
        boredom += 0.3;
        break;
      case "entropy_low":
        boredom *= 0.8;
        break;
    }

    return {
      energy: clamp01(energy),
      boredom: clamp01(boredom),
      frustration: clamp01(frustration),
    };
  } finally {
    const durationMs = performance.now() - start;
    cognitivePhysiologyUpdateDuration.observe(durationMs / 1000);
    const shouldWarn = process.env.NODE_ENV !== "test";
    if (shouldWarn && durationMs > 0.01) {
    }
  }
};
