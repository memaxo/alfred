import type { AtifTrajectory } from "./atif";

export interface AtifValidationError {
  path: string;
  message: string;
}

export interface AtifValidationResult {
  ok: boolean;
  errors: AtifValidationError[];
}

function isIsoTimestamp(v: string): boolean {
  const t = Date.parse(v);
  if (!Number.isFinite(t)) {
    return false;
  }
  // Normalize and ensure round-trip stability.
  return new Date(t).toISOString() === v;
}

export function validateAtifTrajectory(
  traj: AtifTrajectory
): AtifValidationResult {
  const errors: AtifValidationError[] = [];

  // step_id must be sequential from 1
  for (let i = 0; i < traj.steps.length; i++) {
    const expected = i + 1;
    const got = traj.steps[i]?.step_id;
    if (got !== expected) {
      errors.push({
        path: `steps.${i}.step_id`,
        message: `expected ${expected}, got ${String(got)}`,
      });
    }
  }

  // timestamp must be ISO 8601
  for (let i = 0; i < traj.steps.length; i++) {
    const ts = traj.steps[i]?.timestamp;
    if (typeof ts !== "string" || !isIsoTimestamp(ts)) {
      errors.push({
        path: `steps.${i}.timestamp`,
        message: "expected ISO 8601 timestamp",
      });
    }
  }

  // tool call IDs must exist for observations
  const toolCallIds = new Set<string>();
  for (let i = 0; i < traj.steps.length; i++) {
    const step = traj.steps[i];
    const calls = Array.isArray(step?.tool_calls) ? step.tool_calls : [];
    for (let j = 0; j < calls.length; j++) {
      const id = calls[j]?.tool_call_id;
      if (typeof id === "string" && id.length > 0) {
        toolCallIds.add(id);
      }
    }
  }
  for (let i = 0; i < traj.steps.length; i++) {
    const step = traj.steps[i];
    const results = step?.observation?.results ?? [];
    for (let j = 0; j < results.length; j++) {
      const id = results[j]?.source_call_id;
      if (typeof id !== "string" || id.length === 0) {
        errors.push({
          path: `steps.${i}.observation.results.${j}.source_call_id`,
          message: "expected non-empty source_call_id",
        });
        continue;
      }
      if (!toolCallIds.has(id)) {
        errors.push({
          path: `steps.${i}.observation.results.${j}.source_call_id`,
          message: `unknown tool call id: ${id}`,
        });
      }
    }
  }

  // agent-only fields must only appear on agent steps
  for (let i = 0; i < traj.steps.length; i++) {
    const step = traj.steps[i];
    if (!step) {
      continue;
    }
    if (step.source !== "agent") {
      if (step.tool_calls && step.tool_calls.length > 0) {
        errors.push({
          path: `steps.${i}.tool_calls`,
          message: "tool_calls only allowed for source=agent",
        });
      }
      if (step.observation && step.observation.results.length > 0) {
        errors.push({
          path: `steps.${i}.observation`,
          message: "observation only allowed for source=agent",
        });
      }
      if (
        typeof step.reasoning_content === "string" &&
        step.reasoning_content.length > 0
      ) {
        errors.push({
          path: `steps.${i}.reasoning_content`,
          message: "reasoning_content only allowed for source=agent",
        });
      }
      if (step.metrics) {
        errors.push({
          path: `steps.${i}.metrics`,
          message: "metrics only allowed for source=agent",
        });
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
