import { patternRepo } from "@alfred/db";
import { logger } from "@alfred/logger";

const DECAY_THRESHOLD_DAYS = 30;
const QUARANTINE_SUCCESS_RATE = 0.3;

/**
 * Manage the lifecycle of workflow patterns.
 * - Decays patterns that haven't been used in 30 days.
 * - Quarantines patterns with a success rate below 30%.
 */
export async function managePatternLifecycle(): Promise<void> {
  const patterns = await patternRepo.listAllPatterns();

  for (const pattern of patterns) {
    let shouldUpdate = false;
    const patch: Partial<typeof pattern> = {};

    // 1. Decay check: Not used in X days
    const lastUsed = pattern.lastUsedAt ?? pattern.createdAt;
    if (lastUsed) {
      const daysSinceUsed = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUsed > DECAY_THRESHOLD_DAYS && pattern.status === "active") {
        patch.status = "retired";
        shouldUpdate = true;
        logger.info("pattern_retired_due_to_inactivity", { patternId: pattern.id, trigger: pattern.trigger });
      }
    }

    // 2. Quarantine check: Low success rate
    const successRate = parseFloat(pattern.successRate);
    if (successRate < QUARANTINE_SUCCESS_RATE && pattern.usageCount > 5 && pattern.status === "active") {
      patch.status = "quarantined";
      shouldUpdate = true;
      logger.warn("pattern_quarantined_due_to_failures", { patternId: pattern.id, trigger: pattern.trigger, successRate });
    }

    if (shouldUpdate) {
      await patternRepo.updatePattern(pattern.id, patch);
    }
  }
}
