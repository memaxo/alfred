/**
 * Assertion functions for ATIF trajectories
 */

import type { AtifTrajectory } from "../types.js";
import { TrajectoryAssertionError } from "../types.js";
import { extractWaves, querySteps, queryToolCalls } from "./query.js";

/**
 * Assert trajectory has a specific number of steps
 */
export function assertStepCount(
  traj: AtifTrajectory,
  min: number,
  max?: number
): void {
  const count = traj.steps.length;

  if (count < min) {
    throw new TrajectoryAssertionError(
      "Step count below minimum",
      "steps.length",
      `>= ${min}`,
      count
    );
  }

  if (max !== undefined && count > max) {
    throw new TrajectoryAssertionError(
      "Step count above maximum",
      "steps.length",
      `<= ${max}`,
      count
    );
  }
}

/**
 * Assert tools were called in a specific sequence
 */
export function assertToolSequence(
  traj: AtifTrajectory,
  sequence: string[]
): void {
  const toolCalls = queryToolCalls(traj);
  const callNames = toolCalls.map((c) => c.function_name);

  // Find the sequence as a subsequence
  let seqIdx = 0;
  for (const name of callNames) {
    if (name === sequence[seqIdx]) {
      seqIdx++;
      if (seqIdx >= sequence.length) {
        return; // Found complete sequence
      }
    }
  }

  throw new TrajectoryAssertionError(
    "Tool sequence not found",
    "tool_calls",
    sequence,
    callNames
  );
}

/**
 * Assert trajectory has a specific number of waves
 */
export function assertWaveCount(traj: AtifTrajectory, count: number): void {
  const waves = extractWaves(traj);

  if (waves.length !== count) {
    throw new TrajectoryAssertionError(
      "Wave count mismatch",
      "waves",
      count,
      waves.length
    );
  }
}

/**
 * Assert trajectory contains an event of a specific type
 */
export function assertHasEvent(traj: AtifTrajectory, eventType: string): void {
  const steps = querySteps(traj, { eventType });

  if (steps.length === 0) {
    throw new TrajectoryAssertionError(
      "Event not found",
      "steps[].extra.eventType",
      eventType,
      "not found"
    );
  }
}

/**
 * Assert trajectory has no error events
 */
export function assertNoErrors(traj: AtifTrajectory): void {
  const errorSteps = querySteps(traj, { eventType: "error" });

  if (errorSteps.length > 0) {
    const errorMessages = errorSteps
      .map((s) => s.message)
      .filter(Boolean)
      .join(", ");

    throw new TrajectoryAssertionError(
      "Trajectory contains errors",
      "steps[].extra.eventType",
      "no errors",
      errorMessages
    );
  }
}
