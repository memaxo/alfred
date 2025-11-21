import { describe, expect, mock, test } from "bun:test";
import { evaluate } from "@alfred/policy";
import { TRPCError } from "@trpc/server";
import { deployRouter } from "../src/routers/deploy";

// Mock dependencies
const mockDb = {
  query: {
    deployments: {
      findMany: mock(() => []),
      findFirst: mock(() => null),
    },
  },
  insert: mock(() => ({
    values: mock(() => ({
      onConflictDoNothing: mock(() => ({ returning: mock(() => []) })),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({ where: mock(() => ({ returning: mock(() => []) })) })),
  })),
};

mock.module("@alfred/db", () => ({
  db: mockDb,
  deployRepo: {
    listDeployments: mock(() => []),
    getDeploymentById: mock(() => null),
    getDeploymentByApp: mock(() => ({
      id: "deploy-123",
      domain: "example.com",
    })),
    upsertDeployment: mock(() => ({ id: "deploy-123" })),
    setDeploymentStatus: mock(() => {}),
    recordHealthCheck: mock(() => {}),
  },
}));

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: mock(() => Promise.resolve()),
}));

mock.module("@alfred/agent/orchestrator/tool/docker", () => ({
  toolDocker: {
    execute: mock(() => ({ details: { hostPort: 3000 } })),
  },
}));

mock.module("@alfred/agent/orchestrator/tool/router", () => ({
  toolRouter: {
    execute: mock(() => {}),
  },
}));

mock.module("@alfred/policy", () => ({
  evaluate: mock(async () => ({
    allow: true,
    obligations: [],
  })),
}));

describe("Deploy Router Policy Enforcement", () => {
  test("promote throws PRECONDITION_FAILED when obligations exist", async () => {
    // Force evaluate to return obligations for this test
    (evaluate as any).mockResolvedValueOnce({
      allow: true,
      obligations: ["biometric"],
    });

    const caller = deployRouter.createCaller({
      session: { user: { id: "user-1", role: "user" } },
    } as any);

    try {
      await caller.promote({
        app: "my-app",
        upstream: "http://localhost:3000",
        authz: "token",
      });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      const trpcError = error as TRPCError;
      expect(trpcError.code).toBe("PRECONDITION_FAILED");
      expect(trpcError.message).toBe("obligation_required");
      const cause = trpcError.cause as any;
      expect(cause.obligations).toEqual(["biometric"]);
    }
  });

  test("remove throws PRECONDITION_FAILED when obligations exist", async () => {
    (evaluate as any).mockResolvedValueOnce({
      allow: true,
      obligations: ["approval"],
    });

    const caller = deployRouter.createCaller({
      session: { user: { id: "user-1", role: "user" } },
    } as any);

    try {
      await caller.remove({
        app: "my-app",
        authz: "token",
      });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      const trpcError = error as TRPCError;
      expect(trpcError.code).toBe("PRECONDITION_FAILED");
      expect(trpcError.message).toBe("obligation_required");
      const cause = trpcError.cause as any;
      expect(cause.obligations).toEqual(["approval"]);
    }
  });
});
