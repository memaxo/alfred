import { beforeAll, describe, expect, mock, test } from "bun:test";
import { createTestSession } from "@alfred/test-kit/auth";
import type { Obligation } from "@alfred/type";
import { TRPCError } from "@trpc/server";

// Install stable DB stubs so this test doesn't override @alfred/db.
import "./utils/mock-db-client";
import "./utils/mock-metrics";
import { dbModuleStub } from "./utils/mock-db-client";

Object.assign(dbModuleStub.deployRepo, {
  listDeployments: mock(() => []),
  getDeploymentById: mock(() => null),
  getDeploymentByApp: mock(() => ({
    id: "deploy-123",
    domain: "example.com",
  })),
  upsertDeployment: mock(() => ({ id: "deploy-123" })),
  setDeploymentStatus: mock(() => {}),
  recordHealthCheck: mock(() => {}),
});

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: mock(() => Promise.resolve()),
}));

mock.module("@alfred/agent/orchestrator/tool/docker", () => ({
  toolDocker: {
    build: mock(() => {}),
    run: mock(() => {}),
    stop: mock(() => {}),
    execute: mock(() => ({ details: { hostPort: 3000 } })),
  },
}));

mock.module("@alfred/agent/orchestrator/tool/router", () => ({
  toolRouter: {
    addRoute: mock(() => {}),
    removeRoute: mock(() => {}),
    execute: mock(() => {}),
  },
}));

describe("Deploy Router Policy Enforcement", () => {
  let deployRouter: typeof import("../src/routers/deploy")["deployRouter"];
  let evaluate: typeof import("@alfred/policy")["evaluate"];

  beforeAll(async () => {
    ({ evaluate } = await import("@alfred/policy"));
    ({ deployRouter } = await import("../src/routers/deploy"));
  });

  test("promote throws PRECONDITION_FAILED when obligations exist", async () => {
    // Force evaluate to return obligations for this test
    const biometricObligation: Obligation = {
      type: "biometric",
      reason: "biometric_required",
      metadata: { code: "requireBio" },
    };
    (
      evaluate as unknown as {
        mockResolvedValueOnce: (value: unknown) => void;
      }
    ).mockResolvedValueOnce({
      allow: true,
      obligations: [biometricObligation],
    });

    const session = createTestSession({ id: "user-1" });
    const caller = deployRouter.createCaller({
      session,
    } as Parameters<typeof deployRouter.createCaller>[0]);

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
      expect(cause.obligations).toEqual([biometricObligation]);
    }
  });

  test("remove throws PRECONDITION_FAILED when obligations exist", async () => {
    const approvalObligation: Obligation = {
      type: "confirmation",
      reason: "manual_approval",
      metadata: { code: "approval" },
    };
    (
      evaluate as unknown as {
        mockResolvedValueOnce: (value: unknown) => void;
      }
    ).mockResolvedValueOnce({
      allow: true,
      obligations: [approvalObligation],
    });

    const session = createTestSession({ id: "user-1" });
    const caller = deployRouter.createCaller({
      session,
    } as Parameters<typeof deployRouter.createCaller>[0]);

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
      expect(cause.obligations).toEqual([approvalObligation]);
    }
  });
});
