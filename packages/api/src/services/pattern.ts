import { logger } from "@alfred/logger";

type UpsertWorkflowPatternArgs = {
  userId: string;
  projectId?: string | null;
  intent: string;
  planTemplate: unknown;
  durationMs: number;
};

function toKebabCase(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "workflow";
}

function fallbackTrigger(intent: string): string {
  const words = intent.trim().toLowerCase().split(/\s+/).slice(0, 4);
  return toKebabCase(words.join("-"));
}

export async function upsertWorkflowPatternFromCompletion(
  args: UpsertWorkflowPatternArgs
): Promise<void> {
  const trigger = fallbackTrigger(args.intent);

  let embedding: number[] | undefined;
  try {
    const { embed } = await import("@alfred/rag");
    embedding = await embed(trigger);
  } catch {
    embedding = undefined;
  }

  try {
    const { patternRepo } = await import("@alfred/db");
    const existing = await patternRepo.getActivePatternByTrigger({
      userId: args.userId,
      projectId: args.projectId ?? null,
      trigger,
    });

    if (!existing) {
      await patternRepo.createPattern({
        userId: args.userId,
        projectId: args.projectId ?? undefined,
        trigger,
        embedding,
        planTemplate: args.planTemplate,
        successRate: "1.0000",
        avgDurationMs: args.durationMs,
        usageCount: 1,
        lastUsedAt: new Date(),
        status: "active",
      });
      return;
    }

    const prevCount =
      typeof existing.usageCount === "number" ? existing.usageCount : 0;
    const nextCount = prevCount + 1;
    const prevRate =
      Number.parseFloat(String(existing.successRate ?? "0")) || 0;
    const nextRate = (prevRate * prevCount + 1) / nextCount;

    const prevAvg =
      typeof existing.avgDurationMs === "number" ? existing.avgDurationMs : 0;
    const nextAvg = Math.round(
      (prevAvg * prevCount + args.durationMs) / nextCount
    );

    const patch: Record<string, unknown> = {
      planTemplate: args.planTemplate,
      usageCount: nextCount,
      successRate: nextRate.toFixed(4),
      avgDurationMs: nextAvg,
      lastUsedAt: new Date(),
      status: "active",
    };
    if (embedding) {
      patch.embedding = embedding;
    }

    await patternRepo.updatePattern(existing.id, patch as never);
  } catch (error) {
    logger.warn("workflow_pattern_upsert_failed", {
      userId: args.userId,
      projectId: args.projectId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
