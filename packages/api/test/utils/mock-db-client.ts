import { mock, vi } from "bun:test";

// Prefer sqlite for tests to avoid requiring Postgres.
process.env.DATABASE_URL ??= "sqlite::memory:";

const conversationRepoShim = {
  createConversation: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).createConversation(...args),
  getConversationByWorkflow: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).getConversationByWorkflow(...args),
  getConversation: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).getConversation(...args),
  createMessage: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).createMessage(...args),
  getMessage: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).getMessage(...args),
  getMessages: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).getMessages(...args),
  getConversations: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).getConversations(...args),
  getActiveUserIds: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).getActiveUserIds(...args),
  getConversationHistory: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).getConversationHistory(...args),
  messageRowToUIMessage: (...args: any[]) =>
    (dbModuleStub.conversationRepo as any).messageRowToUIMessage(...args),
} as const;
const defaultConversationRow = {
  id: "conversation-default",
  userId: "test-user",
  title: null,
  workflowId: null,
  created: new Date(),
  updated: new Date(),
};

export const dbModuleStub = {
  codexRunRepo: {
    createRun: vi.fn(),
    getRun: vi.fn().mockResolvedValue(null),
    getLatestRunBySession: vi.fn().mockResolvedValue(null),
    listRuns: vi.fn().mockResolvedValue([]),
    finalizeRun: vi.fn().mockResolvedValue(null),
    appendEventsBatch: vi.fn().mockResolvedValue({ inserted: 0 }),
    listEvents: vi.fn().mockResolvedValue([]),
    searchEvents: vi.fn().mockResolvedValue([]),
    pruneOldRuns: vi
      .fn()
      .mockResolvedValue({ deletedRuns: 0, deletedEvents: 0 }),
  },
  deployRepo: {
    listDeployments: vi.fn().mockResolvedValue([]),
    getDeploymentById: vi.fn().mockResolvedValue(null),
    getDeploymentByApp: vi.fn().mockResolvedValue(null),
    createDeployment: vi.fn().mockResolvedValue(null),
    removeDeployment: vi.fn().mockResolvedValue(undefined),
    upsertDeployment: vi.fn().mockResolvedValue({ id: "deploy-123" }),
    setDeploymentStatus: vi.fn().mockResolvedValue(undefined),
    recordHealthCheck: vi.fn().mockResolvedValue(undefined),
  },
  linearRepo: {
    upsertLinear: vi.fn().mockResolvedValue(undefined),
    getLinearByOAuth: vi.fn().mockResolvedValue(null),
  },
  conversationRepo: {
    createConversation: vi.fn().mockResolvedValue(defaultConversationRow),
    getConversationByWorkflow: vi.fn().mockResolvedValue(null),
    getConversation: vi.fn().mockResolvedValue(null),
    createMessage: vi.fn().mockResolvedValue(null),
    getMessage: vi.fn().mockResolvedValue(null),
    getMessages: vi.fn().mockResolvedValue([]),
    getConversations: vi.fn().mockResolvedValue([]),
    getActiveUserIds: vi.fn().mockResolvedValue([]),
    getConversationHistory: vi
      .fn()
      .mockResolvedValue({ conversation: null, messages: [] }),
    messageRowToUIMessage: vi.fn(
      (row: { id: string; role?: string; content?: string }) => ({
        id: row.id,
        role: row.role ?? "assistant",
        parts: [{ type: "text", text: row.content ?? "" }],
      })
    ),
  },
  userRepo: {
    getPreferences: vi.fn().mockResolvedValue([]),
    setPreference: vi
      .fn()
      .mockImplementation(
        (
          userId: string,
          key: string,
          value: unknown,
          confidence = 1,
          source = "user"
        ) =>
          Promise.resolve({
            id: `pref-${Date.now()}`,
            userId,
            key,
            value,
            confidence,
            source,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
      ),
    deletePreference: vi.fn().mockResolvedValue(0),
    addFeedback: vi.fn().mockResolvedValue(undefined),
    getFeedback: vi.fn().mockResolvedValue([]),
    getProfile: vi.fn().mockImplementation((userId: string) =>
      Promise.resolve({
        id: userId,
        name: "Test User",
        email: `${userId}@test.local`,
        preferences: [],
      })
    ),
    upsertProfile: vi.fn().mockImplementation(
      (
        userId: string,
        patch: {
          name?: string;
          email?: string;
          avatar?: string;
          timezone?: string;
        }
      ) =>
        Promise.resolve({
          userId,
          name: patch.name ?? "Test User",
          email: patch.email ?? `${userId}@test.local`,
          avatar: patch.avatar ?? null,
          timezone: patch.timezone ?? null,
        })
    ),
    searchFacts: vi.fn().mockResolvedValue([]),
    listFacts: vi.fn().mockResolvedValue([]),
    deleteFact: vi.fn().mockResolvedValue(1),
    getEvents: vi.fn().mockResolvedValue([]),
  },
  workflowRepo: {},
  assistantSchema: {},
  deploySchema: {},
  evalSchema: {},
  graphSchema: {},
  linearSchema: {},
  policySchema: {},
  ragSchema: {},
  conversationSchema: {},
  userSchema: {},
  workflowSchema: {},
};

const dbAbs = new URL("../../../db/src/index.ts", import.meta.url).pathname;
const realDb = await import(dbAbs);
mock.module("@alfred/db", () => ({
  ...realDb,
  codexRunRepo: dbModuleStub.codexRunRepo,
  userRepo: dbModuleStub.userRepo,
  deployRepo: dbModuleStub.deployRepo,
  linearRepo: dbModuleStub.linearRepo,
}));
mock.module("@alfred/db/repo/conversation", () => conversationRepoShim);
mock.module("@alfred/db/src/repo/conversation", () => conversationRepoShim);
mock.module("@alfred/db/repo/user", () => dbModuleStub.userRepo);
mock.module("@alfred/db/src/repo/user", () => dbModuleStub.userRepo);
mock.module("@alfred/db/repo/deploy", () => dbModuleStub.deployRepo);
mock.module("@alfred/db/src/repo/deploy", () => dbModuleStub.deployRepo);
mock.module("@alfred/db/repo/linear", () => dbModuleStub.linearRepo);
mock.module("@alfred/db/src/repo/linear", () => dbModuleStub.linearRepo);
mock.module("@alfred/db/repo/codex-run", () => dbModuleStub.codexRunRepo);
mock.module("@alfred/db/src/repo/codex-run", () => dbModuleStub.codexRunRepo);

// No-op policy audit logging during tests
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => {},
}));
