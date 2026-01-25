/**
 * Router Dependencies
 *
 * This module defines injectable dependencies for tRPC routers.
 * Use DI to enable proper test isolation without mock.module() pollution.
 *
 * @see docs/architecture/test-dependency-injection.md
 */

// ─── Dependency Types ───────────────────────────────────────────────────────────

/** Embedding service interface */
export interface EmbedDeps {
  embedMany: (texts: string[]) => Promise<number[][]>;
  cosineSimilarity: (a: number[], b: number[]) => number;
}

/** Cognitive repository interface - mirrors @alfred/db/repo/cognitive exports */
export interface CognitiveRepoDeps {
  appendEvent: (
    streamId: string,
    type: string,
    payload: Record<string, unknown>,
    options?: { parentId?: string | null; seq?: number | null }
  ) => Promise<unknown>;
  saveSnapshot: (
    streamId: string,
    state: Record<string, unknown>,
    lastEventId: string
  ) => Promise<void>;
  getLatestSnapshot: (streamId: string) => Promise<unknown | undefined>;
  getEventsSince: (streamId: string, since: Date) => Promise<unknown[]>;
  getAllEvents: (streamId: string) => Promise<unknown[]>;
}

/** Cognitive domain dependencies */
export interface CognitiveDeps {
  cognitiveRepo: Partial<CognitiveRepoDeps>;
}

/** Policy evaluation interface */
export interface PolicyDeps {
  evaluate: (
    resource: unknown,
    context: unknown
  ) => Promise<{ allow: boolean; obligations: unknown[] }>;
}

/** Runtime execution interface */
export interface RuntimeDeps {
  runCognitiveLoop?: (
    input: unknown
  ) => AsyncGenerator<{ type: string; payload: unknown }>;
  runAssistantGeneration?: (
    input: unknown
  ) => AsyncGenerator<{ type: string; payload: unknown }>;
}

/** Workflow repository interface */
export interface WorkflowDeps {
  getRun: (runId: string) => Promise<unknown | null>;
  updateRun: (runId: string, patch: unknown) => Promise<void>;
  appendEvent: (runId: string, event: unknown) => Promise<void>;
}

/** Plan service interface */
export interface PlanDeps {
  extractPatternFromRun: (runId: string) => Promise<unknown>;
  extractAntiPatternFromRun: (
    runId: string,
    reason: string
  ) => Promise<unknown>;
  learnProjectConventions: (projectId: string) => Promise<unknown>;
}

/** Assistant router dependencies */
export interface AssistantDeps {
  generateText: (
    input: Parameters<typeof import("./ai/generate").generateText>[0]
  ) => Promise<
    Awaited<ReturnType<typeof import("./ai/generate").generateText>>
  >;
  persistResult: (
    args: Parameters<typeof import("./ai/generate").persistResult>[0]
  ) => Promise<string | null>;
  handoffExecute: (args: {
    input: {
      userId: string;
      requirement: string;
      auto?: "read" | "low";
      authz?: string;
      workspace?: string;
      repoBase?: string;
      context?: Record<string, unknown>;
    };
    runtimeContext?: unknown;
  }) => Promise<{
    ok: boolean;
    runId: string | null;
    summary: string | null;
    ticketId: string | null;
    ticketUrl: string | null;
    plan: unknown | null;
    results: unknown[] | null;
    next: {
      kind: "navigate" | "start-workflow";
      href?: string;
      reason?: string;
    } | null;
  }>;
}

/** Preference inference/cache interface */
export interface PreferenceDeps {
  invalidatePreferenceCache: (
    userId: string,
    projectId?: string
  ) => Promise<void>;
  inferPreferenceFromCorrection: (
    original: import("@alfred/type/stream").UIMessage,
    corrected: import("@alfred/type/stream").UIMessage,
    correctionType: "verbosity" | "tone" | "format" | "content"
  ) => Promise<{
    key: import("@alfred/type/preference").PreferenceKey;
    value: import("@alfred/type/preference").PreferenceDetail["value"];
  } | null>;
}

// ─── Combined Router Dependencies ───────────────────────────────────────────────

/**
 * All injectable dependencies for routers.
 * Pass via context: `ctx.deps`
 */
export interface RouterDeps {
  embed?: Partial<EmbedDeps>;
  cognitive?: Partial<CognitiveDeps>;
  policy?: Partial<PolicyDeps>;
  runtime?: Partial<RuntimeDeps>;
  workflow?: Partial<WorkflowDeps>;
  plan?: Partial<PlanDeps>;
  assistant?: Partial<AssistantDeps>;
  preference?: Partial<PreferenceDeps>;
}

// ─── Default Dependencies ───────────────────────────────────────────────────────

/**
 * Create default dependencies using real implementations.
 * Call lazily to avoid import-time side effects.
 */
export async function createDefaultDeps(): Promise<RouterDeps> {
  // Lazy imports to avoid side effects at module load time
  const [embedModule, dbModule] = await Promise.all([
    import("@alfred/embed"),
    import("@alfred/db"),
  ]);

  return {
    embed: {
      embedMany: embedModule.embedMany,
      cosineSimilarity: embedModule.cosineSimilarity,
    },
    cognitive: {
      cognitiveRepo: dbModule.cognitiveRepo,
    },
  };
}

// ─── Test Utilities ─────────────────────────────────────────────────────────────

/**
 * Create mock dependencies for testing.
 * Override specific deps as needed.
 */
export function createMockDeps(
  overrides: Partial<RouterDeps> = {}
): RouterDeps {
  return {
    embed: {
      embedMany: async () => [[1, 0, 0]],
      cosineSimilarity: () => 1,
      ...overrides.embed,
    },
    cognitive: {
      cognitiveRepo: {
        getLatestSnapshot: async () => {},
        appendEvent: async () => ({}),
        saveSnapshot: async () => {},
        getEventsSince: async () => [],
        getAllEvents: async () => [],
      },
      ...overrides.cognitive,
    },
    policy: {
      evaluate: async () => ({ allow: true, obligations: [] }),
      ...overrides.policy,
    },
    runtime: {
      ...overrides.runtime,
    },
    workflow: {
      getRun: async () => null,
      updateRun: async () => {},
      appendEvent: async () => {},
      ...overrides.workflow,
    },
    plan: {
      extractPatternFromRun: async () => ({}),
      extractAntiPatternFromRun: async () => ({}),
      learnProjectConventions: async () => ({}),
      ...overrides.plan,
    },
    assistant: {
      generateText: async (input) => {
        const [{ generateText }, { MockLanguageModelV3 }] = await Promise.all([
          import("ai"),
          import("ai/test"),
        ]);

        const base = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: "stop",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            content: [{ type: "text", text: "" }],
            warnings: [],
          }),
        });

        return generateText({
          ...input,
          model: base as unknown as Parameters<typeof generateText>[0]["model"],
        });
      },
      persistResult: async () => null,
      handoffExecute: async () => ({
        ok: true,
        runId: null,
        summary: null,
        ticketId: null,
        ticketUrl: null,
        plan: null,
        results: null,
        next: null,
      }),
      ...overrides.assistant,
    },
  };
}
