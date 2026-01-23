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

const userRepoShim = {
  getPreferences: (...args: any[]) =>
    (dbModuleStub.userRepo as any).getPreferences(...args),
  setPreference: (...args: any[]) =>
    (dbModuleStub.userRepo as any).setPreference(...args),
  deletePreference: (...args: any[]) =>
    (dbModuleStub.userRepo as any).deletePreference(...args),
  addFeedback: (...args: any[]) =>
    (dbModuleStub.userRepo as any).addFeedback(...args),
  getFeedback: (...args: any[]) =>
    (dbModuleStub.userRepo as any).getFeedback(...args),
  getProfile: (...args: any[]) =>
    (dbModuleStub.userRepo as any).getProfile(...args),
  upsertProfile: (...args: any[]) =>
    (dbModuleStub.userRepo as any).upsertProfile(...args),
  searchFacts: (...args: any[]) =>
    (dbModuleStub.userRepo as any).searchFacts(...args),
  listFacts: (...args: any[]) =>
    (dbModuleStub.userRepo as any).listFacts(...args),
  deleteFact: (...args: any[]) =>
    (dbModuleStub.userRepo as any).deleteFact(...args),
  getEvents: (...args: any[]) =>
    (dbModuleStub.userRepo as any).getEvents(...args),
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
    getPreferences: vi.fn(),
    setPreference: vi.fn(),
    deletePreference: vi.fn(),
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
  focusRepo: {},
  attentionRepo: {},
  deltaRepo: {},
  clarificationRepo: {
    listRequestsByRunId: vi.fn().mockResolvedValue([]),
  },
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

type FocusSetRow = {
  id: string;
  userId: string;
  title: string | null;
  status: "active" | "closed";
  wipLimit: number;
  startsAt: Date | null;
  endsAt: Date | null;
  lastTouchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type FocusCommitmentRow = {
  id: string;
  userId: string;
  focusSetId: string;
  title: string;
  status: "active" | "paused" | "done" | "cancelled";
  lane: "spotlight" | "background" | "maintenance";
  priority: number;
  workflowRunId: string | null;
  conversationId: string | null;
  lastTouchedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

type AttentionItemRow = {
  id: string;
  userId: string;
  focusSetId: string | null;
  commitmentId: string | null;
  workflowRunId: string | null;
  kind: string;
  status: "open" | "acknowledged" | "resolved";
  urgency: "low" | "normal" | "high" | "critical";
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DeltaBriefRow = {
  id: string;
  userId: string;
  focusSetId: string | null;
  commitmentId: string | null;
  workflowRunId: string | null;
  scope: "focus_set" | "commitment" | "workflow_run";
  sinceAt: Date | null;
  untilAt: Date | null;
  summaryText: string;
  data: Record<string, unknown> | null;
  createdAt: Date;
};

let focusSetSeq = 0;
let commitmentSeq = 0;
let attentionSeq = 0;
let deltaSeq = 0;
const focusSetStore = new Map<string, FocusSetRow>();
const commitmentStore = new Map<string, FocusCommitmentRow>();
const attentionStore = new Map<string, AttentionItemRow>();
const deltaStore = new Map<string, DeltaBriefRow>();

function focusReset(): void {
  focusSetSeq = 0;
  commitmentSeq = 0;
  attentionSeq = 0;
  deltaSeq = 0;
  focusSetStore.clear();
  commitmentStore.clear();
  attentionStore.clear();
  deltaStore.clear();
}

function listByCreatedAtDesc<T extends { createdAt: Date }>(rows: T[]): T[] {
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

dbModuleStub.focusRepo = {
  createFocusSet: vi.fn(async (data: any) => {
    const now = new Date();
    const id = crypto.randomUUID();
    const row: FocusSetRow = {
      id,
      userId: String(data.userId),
      title: data.title ?? null,
      status: (data.status ?? "active") as FocusSetRow["status"],
      wipLimit: typeof data.wipLimit === "number" ? data.wipLimit : 5,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      lastTouchedAt: data.lastTouchedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    focusSetStore.set(id, row);
    return row;
  }),
  getFocusSetById: vi.fn(async (id: string) => focusSetStore.get(id) ?? null),
  listFocusSets: vi.fn(async (args: any) => {
    const userId = String(args.userId);
    const status = args.status as FocusSetRow["status"] | undefined;
    const limit = typeof args.limit === "number" ? args.limit : 20;
    const offset = typeof args.offset === "number" ? args.offset : 0;
    const rows = [...focusSetStore.values()]
      .filter((r) => r.userId === userId)
      .filter((r) => (status ? r.status === status : true));
    return listByCreatedAtDesc(rows).slice(offset, offset + limit);
  }),
  touchFocusSet: vi.fn(async (id: string) => {
    const row = focusSetStore.get(id);
    if (!row) {
      return;
    }
    const now = new Date();
    row.lastTouchedAt = now;
    row.updatedAt = now;
  }),
  updateFocusSet: vi.fn(async (id: string, patch: any) => {
    const row = focusSetStore.get(id);
    if (!row) {
      throw new Error("focus_set_update_failed");
    }
    const now = new Date();
    Object.assign(row, patch);
    row.updatedAt = now;
    focusSetStore.set(id, row);
    return row;
  }),
  createCommitment: vi.fn(async (data: any) => {
    const now = new Date();
    const id = crypto.randomUUID();
    const row: FocusCommitmentRow = {
      id,
      userId: String(data.userId),
      focusSetId: String(data.focusSetId),
      title: String(data.title),
      status: (data.status ?? "active") as FocusCommitmentRow["status"],
      lane: (data.lane ?? "background") as FocusCommitmentRow["lane"],
      priority: typeof data.priority === "number" ? data.priority : 0,
      workflowRunId: data.workflowRunId ?? null,
      conversationId: data.conversationId ?? null,
      lastTouchedAt: data.lastTouchedAt ?? null,
      metadata: data.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    commitmentStore.set(id, row);
    return row;
  }),
  getCommitmentById: vi.fn(
    async (id: string) => commitmentStore.get(id) ?? null
  ),
  listCommitments: vi.fn(async (args: any) => {
    const userId = String(args.userId);
    const focusSetId =
      typeof args.focusSetId === "string" ? args.focusSetId : undefined;
    const status = args.status as FocusCommitmentRow["status"] | undefined;
    const lane = args.lane as FocusCommitmentRow["lane"] | undefined;
    const limit = typeof args.limit === "number" ? args.limit : 50;
    const offset = typeof args.offset === "number" ? args.offset : 0;
    const rows = [...commitmentStore.values()]
      .filter((r) => r.userId === userId)
      .filter((r) => (focusSetId ? r.focusSetId === focusSetId : true))
      .filter((r) => (status ? r.status === status : true))
      .filter((r) => (lane ? r.lane === lane : true));
    return listByCreatedAtDesc(rows).slice(offset, offset + limit);
  }),
  touchCommitment: vi.fn(async (id: string) => {
    const row = commitmentStore.get(id);
    if (!row) {
      return;
    }
    const now = new Date();
    row.lastTouchedAt = now;
    row.updatedAt = now;
  }),
  updateCommitment: vi.fn(async (id: string, patch: any) => {
    const row = commitmentStore.get(id);
    if (!row) {
      throw new Error("focus_commitment_update_failed");
    }
    const now = new Date();
    Object.assign(row, patch);
    row.updatedAt = now;
    commitmentStore.set(id, row);
    return row;
  }),
};

dbModuleStub.attentionRepo = {
  createAttentionItem: vi.fn(async (data: any) => {
    const now = new Date();
    const id = crypto.randomUUID();
    const row: AttentionItemRow = {
      id,
      userId: String(data.userId),
      focusSetId: data.focusSetId ?? null,
      commitmentId: data.commitmentId ?? null,
      workflowRunId: data.workflowRunId ?? null,
      kind: String(data.kind),
      status: (data.status ?? "open") as AttentionItemRow["status"],
      urgency: (data.urgency ?? "normal") as AttentionItemRow["urgency"],
      title: data.title ?? null,
      body: data.body ?? null,
      payload: data.payload ?? null,
      resolvedAt: data.resolvedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    attentionStore.set(id, row);
    return row;
  }),
  getAttentionItemById: vi.fn(
    async (id: string) => attentionStore.get(id) ?? null
  ),
  listAttentionItems: vi.fn(async (args: any) => {
    const userId = String(args.userId);
    const kind = typeof args.kind === "string" ? args.kind : undefined;
    const status = args.status as AttentionItemRow["status"] | undefined;
    const urgency = args.urgency as AttentionItemRow["urgency"] | undefined;
    const focusSetId =
      typeof args.focusSetId === "string" ? args.focusSetId : undefined;
    const commitmentId =
      typeof args.commitmentId === "string" ? args.commitmentId : undefined;
    const workflowRunId =
      typeof args.workflowRunId === "string" ? args.workflowRunId : undefined;
    const limit = typeof args.limit === "number" ? args.limit : 50;
    const offset = typeof args.offset === "number" ? args.offset : 0;

    const rows = [...attentionStore.values()]
      .filter((r) => r.userId === userId)
      .filter((r) => (kind ? r.kind === kind : true))
      .filter((r) => (status ? r.status === status : true))
      .filter((r) => (urgency ? r.urgency === urgency : true))
      .filter((r) => (focusSetId ? r.focusSetId === focusSetId : true))
      .filter((r) => (commitmentId ? r.commitmentId === commitmentId : true))
      .filter((r) =>
        workflowRunId ? r.workflowRunId === workflowRunId : true
      );

    return listByCreatedAtDesc(rows).slice(offset, offset + limit);
  }),
  updateAttentionItem: vi.fn(async (id: string, patch: any) => {
    const row = attentionStore.get(id);
    if (!row) {
      throw new Error("attention_item_update_failed");
    }
    const now = new Date();
    Object.assign(row, patch);
    row.updatedAt = now;
    attentionStore.set(id, row);
    return row;
  }),
};

dbModuleStub.deltaRepo = {
  createDeltaBrief: vi.fn(async (data: any) => {
    const now = new Date();
    const id = crypto.randomUUID();
    const row: DeltaBriefRow = {
      id,
      userId: String(data.userId),
      focusSetId: data.focusSetId ?? null,
      commitmentId: data.commitmentId ?? null,
      workflowRunId: data.workflowRunId ?? null,
      scope: data.scope as DeltaBriefRow["scope"],
      sinceAt: data.sinceAt ?? null,
      untilAt: data.untilAt ?? null,
      summaryText: String(data.summaryText),
      data: data.data ?? null,
      createdAt: now,
    };
    deltaStore.set(id, row);
    return row;
  }),
  listDeltaBriefs: vi.fn(async (args: any) => {
    const userId = String(args.userId);
    const scope = args.scope as DeltaBriefRow["scope"] | undefined;
    const focusSetId =
      typeof args.focusSetId === "string" ? args.focusSetId : undefined;
    const commitmentId =
      typeof args.commitmentId === "string" ? args.commitmentId : undefined;
    const workflowRunId =
      typeof args.workflowRunId === "string" ? args.workflowRunId : undefined;
    const limit = typeof args.limit === "number" ? args.limit : 50;
    const offset = typeof args.offset === "number" ? args.offset : 0;

    const rows = [...deltaStore.values()]
      .filter((r) => r.userId === userId)
      .filter((r) => (scope ? r.scope === scope : true))
      .filter((r) => (focusSetId ? r.focusSetId === focusSetId : true))
      .filter((r) => (commitmentId ? r.commitmentId === commitmentId : true))
      .filter((r) =>
        workflowRunId ? r.workflowRunId === workflowRunId : true
      );

    return listByCreatedAtDesc(rows).slice(offset, offset + limit);
  }),
};

type PrefRow = {
  id: string;
  userId: string;
  projectId: string | null;
  key: string;
  value: unknown;
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

const prefStore = new Map<string, PrefRow>();

function prefKey(userId: string, key: string, projectId?: string) {
  return `${userId}::${projectId ?? "global"}::${key}`;
}

dbModuleStub.userRepo.getPreferences.mockImplementation(
  (userId: string, projectId?: string) => {
    const out: PrefRow[] = [];
    for (const row of prefStore.values()) {
      if (row.userId !== userId) {
        continue;
      }
      if (projectId) {
        if (row.projectId === null || row.projectId === projectId) {
          out.push(row);
        }
      } else if (row.projectId === null) {
        out.push(row);
      }
    }
    // newest first
    out.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return Promise.resolve(out);
  }
);

dbModuleStub.userRepo.setPreference.mockImplementation(
  (
    userId: string,
    key: string,
    value: unknown,
    confidence = 1,
    source = "user",
    projectId?: string
  ) => {
    const id = `pref-${userId}-${key}-${projectId ?? "global"}`;
    const storeKey = prefKey(userId, key, projectId);
    const existing = prefStore.get(storeKey);
    const createdAt = existing?.createdAt ?? new Date();
    const updatedAt = new Date();
    const row: PrefRow = {
      id,
      userId,
      projectId: projectId ?? null,
      key,
      value,
      confidence,
      source,
      createdAt,
      updatedAt,
    };
    prefStore.set(storeKey, row);
    return Promise.resolve(row);
  }
);

dbModuleStub.userRepo.deletePreference.mockImplementation(
  (userId: string, key: string, projectId?: string) => {
    const storeKey = prefKey(userId, key, projectId);
    const existed = prefStore.delete(storeKey);
    return Promise.resolve(existed ? 1 : 0);
  }
);

const dbAbs = new URL("../../../db/src/index.ts", import.meta.url).pathname;
const realDb = await import(dbAbs);

function applyMockDbClient(): void {
  focusReset();
  mock.module("@alfred/db", () => ({
    ...realDb,
    codexRunRepo: dbModuleStub.codexRunRepo,
    userRepo: userRepoShim,
    deployRepo: dbModuleStub.deployRepo,
    linearRepo: dbModuleStub.linearRepo,
    focusRepo: dbModuleStub.focusRepo,
    attentionRepo: dbModuleStub.attentionRepo,
    deltaRepo: dbModuleStub.deltaRepo,
    clarificationRepo: dbModuleStub.clarificationRepo,
  }));
  mock.module("@alfred/db/repo/conversation", () => conversationRepoShim);
  mock.module("@alfred/db/src/repo/conversation", () => conversationRepoShim);
  mock.module("@alfred/db/repo/user", () => userRepoShim);
  mock.module("@alfred/db/src/repo/user", () => userRepoShim);
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
}

applyMockDbClient();

// Allow the shared test preload to re-apply baseline module mocks between tests.
(
  globalThis as unknown as {
    __alfredRegisterModuleResetter?: (fn: () => void) => void;
  }
).__alfredRegisterModuleResetter?.(applyMockDbClient);
