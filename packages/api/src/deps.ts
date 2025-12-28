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
export type EmbedDeps = {
  embedMany: (texts: string[]) => Promise<number[][]>;
  cosineSimilarity: (a: number[], b: number[]) => number;
};

/** Cognitive repository interface - mirrors @alfred/db/repo/cognitive exports */
export type CognitiveRepoDeps = {
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
};

/** Cognitive domain dependencies */
export type CognitiveDeps = {
  cognitiveRepo: Partial<CognitiveRepoDeps>;
};

/** Policy evaluation interface */
export type PolicyDeps = {
  evaluate: (
    resource: unknown,
    context: unknown
  ) => Promise<{ allow: boolean; obligations: unknown[] }>;
};

/** Runtime execution interface */
export type RuntimeDeps = {
  runCognitiveLoop?: (
    input: unknown
  ) => AsyncGenerator<{ type: string; payload: unknown }>;
  runAssistantGeneration?: (
    input: unknown
  ) => AsyncGenerator<{ type: string; payload: unknown }>;
};

/** Workflow repository interface */
export type WorkflowDeps = {
  getRun: (runId: string) => Promise<unknown | null>;
  updateRun: (runId: string, patch: unknown) => Promise<void>;
  appendEvent: (runId: string, event: unknown) => Promise<void>;
};

/** Plan service interface */
export type PlanDeps = {
  extractPatternFromRun: (runId: string) => Promise<unknown>;
  extractAntiPatternFromRun: (
    runId: string,
    reason: string
  ) => Promise<unknown>;
  learnProjectConventions: (projectId: string) => Promise<unknown>;
};

// ─── Combined Router Dependencies ───────────────────────────────────────────────

/**
 * All injectable dependencies for routers.
 * Pass via context: `ctx.deps`
 */
export type RouterDeps = {
  embed?: Partial<EmbedDeps>;
  cognitive?: Partial<CognitiveDeps>;
  policy?: Partial<PolicyDeps>;
  runtime?: Partial<RuntimeDeps>;
  workflow?: Partial<WorkflowDeps>;
  plan?: Partial<PlanDeps>;
};

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
  };
}
