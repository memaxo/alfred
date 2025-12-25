import type { Phase } from "./types.js";

/**
 * Estimate duration for each phase
 */
export function estimateDurations(phases: Phase[]): Phase[] {
  return phases.map((phase) => {
    // Basic estimation: 5-15 minutes per task depending on title/requirement
    const durationMs = phase.tasks.reduce((acc, task) => {
      let taskMinutes = 5;

      const lowerTitle = task.title.toLowerCase();
      const lowerReq = task.requirement.toLowerCase();

      // Complexity modifiers
      if (lowerTitle.includes("complex") || lowerReq.includes("refactor")) {
        taskMinutes += 10;
      }
      if (lowerTitle.includes("simple") || lowerTitle.includes("stub")) {
        taskMinutes -= 2;
      }
      if (lowerTitle.includes("test") || lowerTitle.includes("fix")) {
        taskMinutes += 3;
      }

      return acc + Math.max(1, taskMinutes) * 60 * 1000;
    }, 0);

    return {
      ...phase,
      estimatedDurationMs: durationMs,
    };
  });
}
