import { TRPCError } from "@trpc/server";

/**
 * Plan domain service helpers
 *
 * Extracts common validation and error handling patterns from plan router
 * to reduce duplication and keep routers thin.
 */

/**
 * Validates that all userId fields in an intent (including nested intents) match the authenticated user
 */
export function validateIntentUserId(
  intent: {
    userId: string;
    multiIntent?: { intents?: unknown[] } | null;
  },
  authenticatedUserId: string
): void {
  if (intent.userId !== authenticatedUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "plan_intent_user_mismatch",
    });
  }
  // Validate nested intents if present
  if (intent.multiIntent?.intents) {
    for (const nestedIntent of intent.multiIntent.intents) {
      const candidate = nestedIntent as {
        userId?: unknown;
        multiIntent?: { intents?: unknown[] } | null;
      };
      if (typeof candidate.userId === "string") {
        validateIntentUserId(
          { multiIntent: candidate.multiIntent, userId: candidate.userId },
          authenticatedUserId
        );
      }
    }
  }
}

/**
 * Ensures a user session exists and returns the user ID
 */
export function requireUserId(
  session: { user?: { id?: string } } | null
): string {
  const userId = session?.user?.id;
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "session_required",
    });
  }
  return userId;
}

/**
 * Plan research domain service
 *
 * Extracts research aggregation logic from plan router to keep routers thin.
 */
export async function gatherExternalResearchService(
  intent: unknown,
  userId: string,
  options?: Record<string, unknown>
) {
  const { gatherExternalResearch, workflowIntentSchema } =
    await import("@alfred/plan");
  const parsedIntent = workflowIntentSchema.parse(intent);
  validateIntentUserId(parsedIntent, userId);
  return await gatherExternalResearch(parsedIntent, options);
}

export async function gatherInternalResearchService(
  intent: unknown,
  userId: string,
  projectId?: string,
  options?: unknown
) {
  const { gatherInternalResearch, workflowIntentSchema } =
    await import("@alfred/plan");
  const parsedIntent = workflowIntentSchema.parse(intent);
  validateIntentUserId(parsedIntent, userId);
  return await gatherInternalResearch(
    parsedIntent,
    projectId,
    options as Record<string, unknown>
  );
}

export async function gatherFullResearchService(
  intent: unknown,
  userId: string,
  options?: unknown
) {
  const { gatherFullResearch, researchOptionsSchema, workflowIntentSchema } =
    await import("@alfred/plan");
  const parsedIntent = workflowIntentSchema.parse(intent);
  const parsedOptions = options
    ? researchOptionsSchema.parse(options)
    : undefined;
  validateIntentUserId(parsedIntent, userId);
  return await gatherFullResearch(parsedIntent, parsedOptions);
}

export async function generatePlanService(
  intent: unknown,
  research: unknown,
  userId: string,
  options?: unknown
) {
  const {
    agentTypeSchema,
    generatePlan,
    researchResultSchema,
    workflowIntentSchema,
  } = await import("@alfred/plan");
  const { z } = await import("zod");

  const parsedIntent = workflowIntentSchema.parse(intent);
  const parsedResearch = researchResultSchema.parse(research);

  const rawOpts = (options ?? undefined) as
    | {
        agentTypes?: unknown;
        maxPhases?: unknown;
        preferParallel?: unknown;
      }
    | undefined;

  const parsedOptions = rawOpts
    ? {
        agentTypes: Array.isArray(rawOpts.agentTypes)
          ? rawOpts.agentTypes.map((t) => agentTypeSchema.parse(t))
          : undefined,
        maxPhases:
          typeof rawOpts.maxPhases === "number"
            ? z.number().int().min(1).max(10).parse(rawOpts.maxPhases)
            : undefined,
        preferParallel:
          typeof rawOpts.preferParallel === "boolean"
            ? rawOpts.preferParallel
            : undefined,
      }
    : undefined;

  validateIntentUserId(parsedIntent, userId);
  return await generatePlan(parsedIntent, parsedResearch, parsedOptions);
}

export async function critiquePlanService(
  plan: unknown,
  intent: unknown,
  research: unknown,
  userId: string,
  options?: unknown
) {
  const {
    critiquePlan,
    researchResultSchema,
    structuredPlanSchema,
    workflowIntentSchema,
  } = await import("@alfred/plan");
  const { z } = await import("zod");

  const parsedPlan = structuredPlanSchema.parse(plan);
  const parsedIntent = workflowIntentSchema.parse(intent);
  const parsedResearch = researchResultSchema.parse(research);
  const optionsSchema = z
    .object({
      maxRevisions: z.number().int().min(1).max(5).optional(),
    })
    .optional();
  const parsedOptions = options ? optionsSchema.parse(options) : undefined;

  validateIntentUserId(parsedIntent, userId);
  return await critiquePlan(
    parsedPlan,
    parsedIntent,
    parsedResearch,
    parsedOptions
  );
}
