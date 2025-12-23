/**
 * State factory functions
 */

import type { AutonomyGradient } from "../autonomy/types.js";
import { defaultPhysiology, type Physiology } from "../physiology/index.js";
import {
  defaultCriteria,
  type Criteria,
  type Decision,
  type Outcome,
  type Plan,
} from "../plan/types.js";
import { confidence, timestamp } from "../util/math.js";
import { calculateError } from "./error.js";
import type { CognitiveState } from "./types.js";

export const idle = (now: number, phy?: Physiology): CognitiveState => ({
  _: "idle",
  since: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const capturing = (
  now: number,
  input: string,
  conf: number,
  phy?: Physiology
): CognitiveState => ({
  _: "capturing",
  input,
  confidence: confidence(conf),
  started: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const thinking = (
  now: number,
  about: string,
  depth = 1,
  traces?: string[],
  phy?: Physiology
): CognitiveState => ({
  _: "thinking",
  about,
  depth: traces ? Math.max(depth, traces.length) : depth,
  paths: [],
  reasoningTraces: traces,
  started: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const deciding = (
  now: number,
  options: Decision[],
  criteria?: Criteria,
  phy?: Physiology
): CognitiveState => ({
  _: "deciding",
  options,
  criteria: criteria || defaultCriteria(),
  weights: [0.4, 0.3, 0.2, 0.1], // safety, speed, accuracy, cost
  deadline: timestamp(now + 5000), // 5s decision timeout
  physiology: phy ?? defaultPhysiology(),
});

export const executing = (
  now: number,
  plan: Plan,
  auto: AutonomyGradient,
  phy?: Physiology
): CognitiveState => ({
  _: "executing",
  plan,
  step: 0,
  auto,
  started: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const reflecting = (
  outcome: Outcome,
  expected: string,
  actual: string,
  phy?: Physiology
): CognitiveState => ({
  _: "reflecting",
  outcome,
  expected,
  actual,
  error: calculateError(expected, actual),
  physiology: phy ?? defaultPhysiology(),
});
