import { createTestSession } from "@alfred/test-kit/auth";
import { type Obligation } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { beforeAll, describe, expect, mock, test } from "bun:test";

// Install stable DB stubs so this test doesn't override @alfred/db.
import "./utils/mock-db-client";
import "./utils/mock-metrics";
import { dbModuleStub } from "./utils/mock-db-client";

Object.assign(dbModuleStub.deployRepo, {
  getDeploymentByApp: mock(() => ({
    id: "deploy-123",
    domain: "example.com",
  })),
  getDeploymentById: mock(() => null),
  listDeployments: mock(() => []),
  recordHealthCheck: mock(() => {}),
  setDeploymentStatus: mock(() => {}),
  upsertDeployment: mock(() => ({ id: "deploy-123" })),
});

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: mock(() => Promise.resolve()),
}));

mock.module("@alfred/agent/orchestrator/tool/docker", () => ({
  toolDocker: {
    build: mock(() => {}),
    execute: mock(() => ({ details: { hostPort: 3000 } })),
    run: mock(() => {}),
    stop: mock(() => {}),
  },
}));

mock.module("@alfred/agent/orchestrator/tool/router", () => ({
  toolRouter: {
    addRoute: mock(() => {}),
    execute: mock(() => {}),
    removeRoute: mock(() => {}),
  },
}));

describe("Deploy Router Policy Enforcement", () => {
  let deployRouter: (typeof import("../src/routers/deploy"))["deployRouter"];
  let evaluate: (typeof import("@alfred/policy"))["evaluate"];

  beforeAll(async () => {
    ({ evaluate } = await import("@alfred/policy"));
    ({ deployRouter } = await import("../src/routers/deploy"));
  });

  test("promote throws PRECONDITION_FAILED when obligations exist", async () => {
    // Force evaluate to return obligations for this test
    const biometricObligation: Obligation = {
      metadata: { code: "requireBio" },
      reason: "biometric_required",
      type: "biometric",
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
        authz: "token",
        upstream: "http://localhost:3000",
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
      metadata: { code: "approval" },
      reason: "manual_approval",
      type: "confirmation",
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
