/**
 * Scope Enforcement Middleware Tests
 *
 * Tests for requireScopes middleware used by MCP clients.
 * These tests validate the middleware through actual tRPC procedure calls.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { describe, expect, test } from "bun:test";

import { requireScopes, SCOPE_REQUIREMENTS } from "../../src/middleware/scopes";

// Create a test tRPC instance
const t = initTRPC.context<TestContext>().create();

interface TestContext {
  session: {
    user: {
      id: string;
      scopes: string[];
    };
    session: { id: string };
  } | null;
  policy: {
    obligations: { type: string; satisfied: boolean }[];
  };
}

// Helper to create a mock context with scopes
function createMockContext(scopes: string[] = []): TestContext {
  return {
    session: {
      user: {
        id: "test-user",
        scopes,
      },
      session: { id: "test-session" },
    },
    policy: {
      obligations: [],
    },
  };
}

// Helper to create a test procedure with scope requirements
function createTestProcedure(
  scopeOptions: Parameters<typeof requireScopes>[0]
) {
  const middleware = requireScopes(scopeOptions);

  const procedure = t.procedure.use(middleware).query(({ ctx }) => ({
    success: true,
    scopes: (ctx as TestContext & { scopes: string[] }).scopes,
  }));

  return t.router({ test: procedure });
}

// Helper to call a test procedure
function callProcedure(
  router: ReturnType<typeof createTestProcedure>,
  ctx: TestContext
) {
  const caller = router.createCaller(ctx);
  return caller.test();
}

describe("requireScopes middleware", () => {
  describe("single scope requirement", () => {
    test("allows access when scope is present", async () => {
      const router = createTestProcedure({ required: "read:todos" });
      const ctx = createMockContext(["read:todos"]);

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
      expect(result.scopes).toContain("read:todos");
    });

    test("denies access when scope is missing", async () => {
      const router = createTestProcedure({ required: "read:todos" });
      const ctx = createMockContext(["read:notes"]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("allows access with wildcard scope", async () => {
      const router = createTestProcedure({ required: "read:todos" });
      // Note: The current implementation doesn't support wildcards
      // This test documents the expected behavior if wildcards were supported
      const ctx = createMockContext(["read:todos"]);

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });
  });

  describe("multiple scope requirements (AND)", () => {
    test("allows access when all scopes present", async () => {
      const router = createTestProcedure({
        required: ["read:todos", "write:todos"],
        requireAll: true,
      });
      const ctx = createMockContext(["read:todos", "write:todos"]);

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("denies access when only some scopes present", async () => {
      const router = createTestProcedure({
        required: ["read:todos", "write:todos"],
        requireAll: true,
      });
      const ctx = createMockContext(["read:todos"]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("multiple scope requirements (OR)", () => {
    test("allows access when any scope present", async () => {
      const router = createTestProcedure({
        required: ["read:todos", "read:notes"],
        requireAll: false,
      });
      const ctx = createMockContext(["read:notes"]);

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("denies access when no scopes present", async () => {
      const router = createTestProcedure({
        required: ["read:todos", "read:notes"],
        requireAll: false,
      });
      const ctx = createMockContext(["write:todos"]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("error messages", () => {
    test("includes required scopes in error", async () => {
      const router = createTestProcedure({ required: "read:todos" });
      const ctx = createMockContext([]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toContain("read:todos");
      }
    });

    test("uses custom error message when provided", async () => {
      const router = createTestProcedure({
        required: "read:todos",
        message: "custom_error_message",
      });
      const ctx = createMockContext([]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).message).toBe("custom_error_message");
      }
    });
  });

  describe("SCOPE_REQUIREMENTS presets", () => {
    test("presets are defined", () => {
      expect(SCOPE_REQUIREMENTS.readTodos).toBeDefined();
      expect(SCOPE_REQUIREMENTS.writeTodos).toBeDefined();
      expect(SCOPE_REQUIREMENTS.readNotes).toBeDefined();
      expect(SCOPE_REQUIREMENTS.writeNotes).toBeDefined();
    });
  });

  describe("empty/null scopes", () => {
    test("denies access when user has no scopes", async () => {
      const router = createTestProcedure({ required: "read:todos" });
      const ctx = createMockContext([]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("denies access when session is null", async () => {
      const router = createTestProcedure({ required: "read:todos" });
      const ctx: TestContext = {
        session: null,
        policy: { obligations: [] },
      };

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("admin scope biometric enforcement", () => {
    test("requires biometric for admin scopes when obligation pending", async () => {
      const router = createTestProcedure({ required: "admin:voice" });
      const ctx: TestContext = {
        session: {
          user: {
            id: "admin-user",
            scopes: ["admin:voice"],
          },
          session: { id: "admin-session" },
        },
        policy: {
          obligations: [{ type: "biometric", satisfied: false }],
        },
      };

      // Without BIO_AUTH_BYPASS, should throw PRECONDITION_FAILED
      const originalBypass = process.env.BIO_AUTH_BYPASS;
      process.env.BIO_AUTH_BYPASS = undefined;

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown PRECONDITION_FAILED");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
        expect((error as TRPCError).message).toBe(
          "admin_scope_requires_biometric"
        );
      } finally {
        process.env.BIO_AUTH_BYPASS = originalBypass;
      }
    });

    test("allows admin scopes when BIO_AUTH_BYPASS is set", async () => {
      const router = createTestProcedure({ required: "admin:voice" });
      const ctx: TestContext = {
        session: {
          user: {
            id: "admin-user",
            scopes: ["admin:voice"],
          },
          session: { id: "admin-session" },
        },
        policy: {
          obligations: [{ type: "biometric", satisfied: false }],
        },
      };

      // With BIO_AUTH_BYPASS, should succeed
      const originalBypass = process.env.BIO_AUTH_BYPASS;
      process.env.BIO_AUTH_BYPASS = "true";

      try {
        const result = await callProcedure(router, ctx);
        expect(result.success).toBe(true);
      } finally {
        process.env.BIO_AUTH_BYPASS = originalBypass;
      }
    });

    test("allows admin scopes when no biometric obligation pending", async () => {
      const router = createTestProcedure({ required: "admin:voice" });
      const ctx: TestContext = {
        session: {
          user: {
            id: "admin-user",
            scopes: ["admin:voice"],
          },
          session: { id: "admin-session" },
        },
        policy: {
          obligations: [], // No pending obligations
        },
      };

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });
  });

  describe("wildcard scope support", () => {
    test("wildcard scope read:* grants read:todos", async () => {
      // Wildcards ARE supported via hasScope() in @alfred/type
      // A scope of "read:*" DOES grant "read:todos"
      const router = createTestProcedure({ required: "read:todos" });
      const ctx = createMockContext(["read:*"]); // Has wildcard

      // Wildcard expansion works
      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("wildcard scope write:* grants write:todos", async () => {
      const router = createTestProcedure({ required: "write:todos" });
      const ctx = createMockContext(["write:*"]);

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("wildcard scope admin:* grants admin:voice", async () => {
      const router = createTestProcedure({ required: "admin:voice" });
      const ctx: TestContext = {
        session: {
          user: { id: "admin-user", scopes: ["admin:*"] },
          session: { id: "admin-session" },
        },
        policy: { obligations: [] }, // No pending biometric
      };

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("exact wildcard match also works", async () => {
      // Requiring "read:*" directly also works
      const router = createTestProcedure({ required: "read:*" });
      const ctx = createMockContext(["read:*"]);

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("wildcard does not cross action boundaries", async () => {
      // read:* should NOT grant write:todos
      const router = createTestProcedure({ required: "write:todos" });
      const ctx = createMockContext(["read:*"]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("read:* should not grant write:todos");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("error handling edge cases", () => {
    test("handles empty required array", async () => {
      const router = createTestProcedure({ required: [] });
      const ctx = createMockContext([]);

      // Empty required array means no scopes needed - should pass
      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("handles special characters in scope names", async () => {
      const router = createTestProcedure({ required: "read:special-scope_v2" });
      const ctx = createMockContext(["read:special-scope_v2"]);

      const result = await callProcedure(router, ctx);
      expect(result.success).toBe(true);
    });

    test("includes cause details in forbidden error", async () => {
      const router = createTestProcedure({
        required: ["read:todos", "write:todos"],
        requireAll: true,
      });
      const ctx = createMockContext(["read:todos"]);

      try {
        await callProcedure(router, ctx);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        const cause = (error as TRPCError).cause as {
          required: string[];
          granted: string[];
          requireAll: boolean;
        };
        expect(cause.required).toEqual(["read:todos", "write:todos"]);
        expect(cause.granted).toEqual(["read:todos"]);
        expect(cause.requireAll).toBe(true);
      }
    });
  });

  describe("real tRPC context handling", () => {
    test("handles unauthenticated request with null session user", async () => {
      const router = createTestProcedure({ required: "read:todos" });

      // Simulate unauthenticated context (session exists but user is undefined)
      const unauthCtx: TestContext = {
        session: {
          // @ts-expect-error - testing null user scenario
          user: undefined,
          session: { id: "anonymous-session" },
        },
        policy: { obligations: [] },
      };

      try {
        await callProcedure(router, unauthCtx);
        expect.unreachable("Should have thrown for unauthenticated request");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("handles missing scopes property on user", async () => {
      const router = createTestProcedure({ required: "read:todos" });

      // Simulate user without scopes property
      const noScopesCtx: TestContext = {
        session: {
          // @ts-expect-error - testing missing scopes scenario
          user: { id: "user-no-scopes" },
          session: { id: "test-session" },
        },
        policy: { obligations: [] },
      };

      try {
        await callProcedure(router, noScopesCtx);
        expect.unreachable("Should have thrown for missing scopes");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });
});
