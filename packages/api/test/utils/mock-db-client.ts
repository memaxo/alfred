import { mock, vi } from "bun:test";

// Provide a minimal Drizzle-like client so any accidental imports of
// @alfred/db/src/client during router tests won't try to initialize a real
// Postgres connection.
const dbStub = new Proxy(
  {},
  {
    get: () => () => ({
      returning: () => [],
      execute: async () => ({ rows: [] }),
    }),
  }
);

const isSqliteDriver = vi.fn(() => false);

mock.module("@alfred/db/src/client", () => ({ db: dbStub, isSqliteDriver }));
mock.module("@alfred/db/client", () => ({ db: dbStub, isSqliteDriver }));
const defaultConversationRow = {
  id: "conversation-default",
  userId: "test-user",
  title: null,
  workflowId: null,
  created: new Date(),
  updated: new Date(),
};

export const dbModuleStub = {
  db: dbStub,
  isSqliteDriver,
  assistantRepo: {},
  deployRepo: {},
  evalRepo: {},
  graphRepo: {},
  linearRepo: {},
  policyRepo: {},
  ragRepo: {},
  conversationRepo: {
    createConversation: vi.fn().mockResolvedValue(defaultConversationRow),
    getConversationByWorkflow: vi.fn().mockResolvedValue(null),
    getConversation: vi.fn().mockResolvedValue(null),
    createMessage: vi.fn().mockResolvedValue(null),
    getMessage: vi.fn().mockResolvedValue(null),
  },
  userRepo: {
    getPreferences: vi.fn().mockResolvedValue([]),
    setPreference: vi.fn().mockResolvedValue(null),
    deletePreference: vi.fn().mockResolvedValue(0),
    addFeedback: vi.fn().mockResolvedValue(undefined),
    getFeedback: vi.fn().mockResolvedValue([]),
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

mock.module("@alfred/db", () => dbModuleStub);
mock.module(
  "@alfred/db/repo/conversation",
  () => dbModuleStub.conversationRepo
);
mock.module(
  "@alfred/db/src/repo/conversation",
  () => dbModuleStub.conversationRepo
);
mock.module("@alfred/db/repo/user", () => dbModuleStub.userRepo);
mock.module("@alfred/db/src/repo/user", () => dbModuleStub.userRepo);

// Provide a default DATABASE_URL to placate any leftover guards
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

// No-op policy audit logging during tests
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => {},
}));
