import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { EMBEDDING_DIM } from "@alfred/embed";
import type { Obligation } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { TRPCError } from "@trpc/server";
import { policyStub } from "./utils/mock-metrics";
import {
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { recordMemoryForgetMock, resetAgentMocks } from "./utils/agent-mock";
import { dbModuleStub } from "./utils/mock-db-client";

setupTestEnv();

const createAuditLogMock = vi.fn().mockResolvedValue(undefined);
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: createAuditLogMock,
}));

const searchFactsMock = vi.fn();
const listFactsMock = vi.fn();
const deleteFactMock = vi.fn();
const getEventsMock = vi.fn();

dbModuleStub.userRepo.searchFacts = searchFactsMock;
dbModuleStub.userRepo.listFacts = listFactsMock;
dbModuleStub.userRepo.deleteFact = deleteFactMock;
dbModuleStub.userRepo.getEvents = getEventsMock;

recordMemoryForgetMock.mockClear();

type PrivacyCaller = {
  facts: (input?: unknown) => Promise<unknown>;
  deleteFact: (input: unknown) => Promise<unknown>;
  events: (input?: unknown) => Promise<unknown>;
};
type PrivacyRouter = {
  createCaller: (ctx: unknown) => PrivacyCaller;
};

let privacyRouter: PrivacyRouter;
let caller: PrivacyCaller;

async function createPrivacyCaller(options?: {
  userId?: string | null;
  includeUserId?: boolean;
  roles?: string[];
  scopes?: string[];
  obligations?: Obligation[];
}) {
  const userId =
    options?.userId === undefined ? "test-user" : options.userId;
  const includeUserId = options?.includeUserId ?? true;
  const roles = options?.roles ?? (userId ? ["owner"] : []);
  const scopes = options?.scopes ?? (userId ? ["privacy.purge"] : []);
  const obligations = options?.obligations ?? [];

  const runtime = {
    requestId: `test-${Date.now()}`,
    receivedAt: new Date(),
    method: "POST",
    url: "http://localhost/test",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: null,
    referer: null,
  };
  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", runtime.receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
    ["userId", userId],
    ["userRoles", roles],
    ["userScopes", scopes],
    ["scanContext", null],
  ]);

  const session =
    userId === null
      ? null
      : ({
          user: includeUserId
            ? {
                id: userId,
                roles,
                scopes,
                email: `${userId}@test.local`,
                name: "Test User",
              }
            : {
                roles,
                scopes,
                email: "anonymous@test.local",
                name: "Anonymous",
              },
          session: { id: `sess-${runtime.requestId}` },
        } as any);

  return privacyRouter.createCaller({
    session,
    runtime,
    runtimeContext,
    policy: { obligations },
  } as any);
}

async function createCallerWithMissingUserId(options?: {
  roles?: string[];
  scopes?: string[];
}) {
  const roles = options?.roles ?? ["owner"];
  const scopes = options?.scopes ?? ["privacy.purge"];
  return createPrivacyCaller({ includeUserId: false, roles, scopes });
}

beforeAll(async () => {
  privacyRouter = (await import("../src/routers/privacy"))
    .privacyRouter as unknown as PrivacyRouter;
  caller = await createPrivacyCaller({
    userId: "test-user",
    scopes: ["privacy.purge"],
  });
});

beforeEach(() => {
  policyStub.evaluate.mockResolvedValue({
    allow: true,
    obligations: [] as Obligation[],
  });
  createAuditLogMock.mockClear();
});

afterEach(() => {
  resetAllMocks();
  resetAgentMocks();
});

describe("privacy router", () => {
  describe("facts", () => {
    it("rejects unauthenticated requests", async () => {
      const unauthed = await createPrivacyCaller({ userId: null });
      await expect(unauthed.facts({})).rejects.toThrow(TRPCError);
    });

    it("rejects sessions without user id", async () => {
      const broken = await createCallerWithMissingUserId();
      await expect(broken.facts({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    });

    it("searches facts by embedding", async () => {
      const mockFacts = [
        { id: "fact-1", content: "fact 1" },
        { id: "fact-2", content: "fact 2" },
      ];

      searchFactsMock.mockResolvedValue(mockFacts);

      const embedding = Array.from({ length: EMBEDDING_DIM }, () => 0.1);
      const result = await caller.facts({
        embedding,
        limit: 10,
        threshold: 0.7,
      });

      expect(searchFactsMock).toHaveBeenCalledWith(
        "test-user",
        embedding,
        10,
        0.7
      );
      expect(result).toEqual(mockFacts);
    });

    it("returns empty list when search returns non-array", async () => {
      searchFactsMock.mockResolvedValueOnce(null);
      const embedding = Array.from({ length: EMBEDDING_DIM }, () => 0.1);
      const result = await caller.facts({ embedding });
      expect(result).toEqual([]);
    });

    it("lists facts without embedding", async () => {
      const mockFacts = [{ id: "fact-1", content: "fact 1" }];
      listFactsMock.mockResolvedValue(mockFacts);

      const result = await caller.facts({
        limit: 10,
        offset: 0,
      });

      expect(listFactsMock).toHaveBeenCalledWith("test-user", 10, 0);
      expect(result).toEqual(mockFacts);
    });

    it("returns empty list when list returns non-array", async () => {
      listFactsMock.mockResolvedValueOnce("not-an-array");
      const result = await caller.facts({ limit: 10, offset: 0 });
      expect(result).toEqual([]);
    });

    it("returns empty list when listFacts is unavailable", async () => {
      const original = dbModuleStub.userRepo.listFacts;
      (dbModuleStub.userRepo as any).listFacts = undefined;
      try {
        const result = await caller.facts({ limit: 10, offset: 0 });
        expect(result).toEqual([]);
      } finally {
        dbModuleStub.userRepo.listFacts = original;
      }
    });
  });

  describe("deleteFact", () => {
    it("rejects unauthenticated requests", async () => {
      const unauthed = await createPrivacyCaller({ userId: null });
      await expect(
        unauthed.deleteFact({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow(TRPCError);
      expect(createAuditLogMock).not.toHaveBeenCalled();
    });

    it("rejects sessions without user id (after auditing as anonymous)", async () => {
      const broken = await createCallerWithMissingUserId();
      await expect(
        broken.deleteFact({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "session_required",
      });

      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "anonymous",
          action: "privacy.purge",
          decision: "allow",
          resource: expect.objectContaining({ kind: "privacy", id: "anonymous" }),
        })
      );
    });

    it("denies deletions when policy denies", async () => {
      policyStub.evaluate.mockResolvedValueOnce({
        allow: false,
        reason: "denied",
        obligations: [] as Obligation[],
      });

      await expect(
        caller.deleteFact({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "denied",
      });

      expect(deleteFactMock).not.toHaveBeenCalled();
      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user",
          action: "privacy.purge",
          decision: "deny",
          resource: expect.objectContaining({ kind: "privacy", id: "test-user" }),
        })
      );
    });

    it("requires MFA (policy obligations) for dangerous deletions", async () => {
      const mfaObligation: Obligation = {
        type: "mfa",
        reason: "mfa_required",
        metadata: { code: "mfa_required" },
      };
      policyStub.evaluate.mockResolvedValueOnce({
        allow: true,
        obligations: [mfaObligation],
      });

      await expect(
        caller.deleteFact({
          id: "00000000-0000-0000-0000-000000000000",
          scope: "fact",
        })
      ).rejects.toMatchObject({
        name: "PolicyObligationError",
        code: "PRECONDITION_FAILED",
        message: "obligation_required",
        cause: expect.objectContaining({
          action: "privacy.purge",
          reason: "privacy_purge",
        }),
      });

      expect(deleteFactMock).not.toHaveBeenCalled();
      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user",
          action: "privacy.purge",
          decision: "allow",
          obligations: [mfaObligation],
        })
      );
    });

    it("deletes a fact", async () => {
      deleteFactMock.mockResolvedValue(1);

      const result = await caller.deleteFact({
        id: "00000000-0000-0000-0000-000000000000",
        scope: "fact",
      });

      expect(deleteFactMock).toHaveBeenCalledWith(
        "test-user",
        "00000000-0000-0000-0000-000000000000"
      );
      expect(recordMemoryForgetMock).toHaveBeenCalledWith("fact");
      expect(result).toEqual({ removed: 1 });
      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user",
          action: "privacy.purge",
          decision: "allow",
          resource: expect.objectContaining({ kind: "privacy", id: "test-user" }),
        })
      );
    });

    it("returns zero when fact not found", async () => {
      deleteFactMock.mockResolvedValue(0);

      const result = await caller.deleteFact({
        id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      });

      expect(result).toEqual({ removed: 0 });
      expect(recordMemoryForgetMock).not.toHaveBeenCalled();
      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user",
          action: "privacy.purge",
          decision: "allow",
        })
      );
    });
  });

  describe("events", () => {
    it("rejects unauthenticated requests", async () => {
      const unauthed = await createPrivacyCaller({ userId: null });
      await expect(unauthed.events({})).rejects.toThrow(TRPCError);
    });

    it("rejects sessions without user id", async () => {
      const broken = await createCallerWithMissingUserId();
      await expect(broken.events({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    });

    it("gets user events", async () => {
      const mockEvents = [
        { id: "event-1", type: "conversation" },
        { id: "event-2", type: "tool_use" },
      ];

      getEventsMock.mockResolvedValue(mockEvents);

      const result = await caller.events({
        type: "conversation",
        limit: 10,
        offset: 0,
      });

      expect(getEventsMock).toHaveBeenCalledWith(
        "test-user",
        "conversation",
        10,
        0
      );
      expect(result).toEqual(mockEvents);
    });

    it("returns empty list when repo returns non-array", async () => {
      getEventsMock.mockResolvedValueOnce({} as any);
      const result = await caller.events({});
      expect(result).toEqual([]);
    });
  });
});
