import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { dbModuleStub } from "./utils/mock-db-client";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";
import { toObservable } from "./utils/stream";
import { TRPCError } from "@trpc/server";

setupTestEnv();
mockPolicyAudit();

const listDeploymentsMock = dbModuleStub.deployRepo.listDeployments;
const getDeploymentByIdMock = dbModuleStub.deployRepo.getDeploymentById;
const getDeploymentByAppMock = dbModuleStub.deployRepo.getDeploymentByApp;
const upsertDeploymentMock = dbModuleStub.deployRepo.upsertDeployment;
const setDeploymentStatusMock = dbModuleStub.deployRepo.setDeploymentStatus;
const recordHealthCheckMock = dbModuleStub.deployRepo.recordHealthCheck;

const toolDockerExecuteMock = vi.fn();
const toolDockerMock = { execute: toolDockerExecuteMock };

const toolRouterExecuteMock = vi.fn();
const toolRouterMock = { execute: toolRouterExecuteMock };

mock.module("@alfred/agent/orchestrator/tool/docker", () => ({
  toolDocker: toolDockerMock,
}));

mock.module("@alfred/agent/orchestrator/tool/router", () => ({
  toolRouter: toolRouterMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let unauthedCaller: Awaited<ReturnType<typeof createUnauthedCaller>>;
let evaluateMock: { mockResolvedValueOnce: (value: unknown) => void };
let deployService: typeof import("../src/services/deploy")["deployService"];

const defaultProbeResult = {
  status: "healthy",
  url: "http://127.0.0.1:3000",
  ts: "2025-01-01T00:00:00.000Z",
} as const;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["deploy.read", "deploy.write"],
  });
  unauthedCaller = await createUnauthedCaller();

  const policyMod = await import("@alfred/policy");
  evaluateMock = policyMod.evaluate as unknown as typeof evaluateMock;

  ({ deployService } = await import("../src/services/deploy"));

  // Keep ports deterministic and avoid binding real sockets in tests.
  deployService.allocatePort = vi
    .fn()
    .mockResolvedValue(30_080) as unknown as typeof deployService.allocatePort;
  // Probe results are router concerns; stub for determinism.
  deployService.probeDeployment = vi
    .fn()
    .mockResolvedValue(defaultProbeResult) as unknown as typeof deployService.probeDeployment;
});

afterEach(() => {
  resetAllMocks();
  // `vi.clearAllMocks()` doesn't reset `mockResolvedValueOnce` queues; ensure
  // per-test isolation for these hot mocks.
  (
    deployService.allocatePort as unknown as {
      mockReset: () => unknown;
      mockResolvedValue: (v: unknown) => unknown;
    }
  )
    .mockReset()
    .mockResolvedValue(30_080);
  (
    deployService.probeDeployment as unknown as {
      mockReset: () => unknown;
      mockResolvedValue: (v: unknown) => unknown;
    }
  )
    .mockReset()
    .mockResolvedValue(defaultProbeResult);
});

describe("deploy router", () => {
  describe("list", () => {
    it("lists deployments", async () => {
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      const mockDeployments = [
        {
          id: deploymentId,
          userId: "test-user",
          app: "app1",
          type: "preview",
          status: "running",
        },
      ];

      listDeploymentsMock.mockResolvedValue(mockDeployments);

      const result = await caller.deploy.list({});

      expect(listDeploymentsMock).toHaveBeenCalled();
      expect(result).toEqual(mockDeployments);
    });

    it("rejects unauthenticated access", async () => {
      await expect(unauthedCaller.deploy.list({})).rejects.toBeInstanceOf(
        TRPCError
      );
    });

    it("rejects when session userId missing", async () => {
      const { deployRouter } = await import("../src/routers/deploy");
      const badCaller = deployRouter.createCaller({
        session: { user: { id: "" } },
      } as Parameters<typeof deployRouter.createCaller>[0]);
      await expect(badCaller.list({})).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe("get", () => {
    it("gets a deployment", async () => {
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      const mockDeployment = {
        id: deploymentId,
        userId: "test-user",
        app: "app1",
        type: "preview",
        status: "running",
      };

      getDeploymentByIdMock.mockResolvedValue(mockDeployment);

      const result = await caller.deploy.get({
        id: deploymentId,
      });

      expect(getDeploymentByIdMock).toHaveBeenCalledWith(deploymentId);
      expect(result).toEqual(mockDeployment);
    });

    it("throws NOT_FOUND when deployment missing", async () => {
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      getDeploymentByIdMock.mockResolvedValue(null);
      await expect(
        caller.deploy.get({
          id: deploymentId,
        })
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it("throws NOT_FOUND when deployment belongs to another user", async () => {
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      getDeploymentByIdMock.mockResolvedValue({
        id: deploymentId,
        userId: "other-user",
        app: "app1",
        type: "preview",
        status: "running",
      });
      await expect(
        caller.deploy.get({
          id: deploymentId,
        })
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it("validates id input", async () => {
      await expect(
        caller.deploy.get({
          id: "not-a-uuid",
        } as Parameters<typeof caller.deploy.get>[0])
      ).rejects.toThrow();
    });
  });

  describe("removeRecord", () => {
    it("marks a deployment record as removed (record-only)", async () => {
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      getDeploymentByIdMock.mockResolvedValue({
        id: deploymentId,
        userId: "test-user",
        app: "app1",
        type: "preview",
        status: "running",
      });

      const result = await caller.deploy.removeRecord({ id: deploymentId });

      expect(setDeploymentStatusMock).toHaveBeenCalledWith(
        deploymentId,
        "removed",
        expect.objectContaining({
          metadata: expect.objectContaining({
            mode: "record-only",
          }),
        })
      );
      expect(result).toEqual({ ok: true });
    });

    it("throws NOT_FOUND when record missing", async () => {
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      getDeploymentByIdMock.mockResolvedValue(null);
      await expect(
        caller.deploy.removeRecord({ id: deploymentId })
      ).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe("createPreview", () => {
    it("creates a preview deployment by building + running + registering route", async () => {
      toolDockerExecuteMock.mockImplementation(async ({ input }) => {
        if (input.action === "build") {
          return { ok: true };
        }
        if (input.action === "run") {
          return {
            details: {
              name: "preview_app1_aaaaaa",
              containerId: "container-123",
              hostPort: 30_080,
              ports: [{ host: 30_080, container: 3000 }],
            },
          };
        }
        throw new Error("unexpected_docker_action");
      });
      toolRouterExecuteMock.mockImplementation(async ({ input }) => {
        if (input.action === "register") {
          return { ok: true };
        }
        if (input.action === "remove") {
          return { ok: true };
        }
        throw new Error("unexpected_router_action");
      });
      upsertDeploymentMock.mockResolvedValue({ id: "deploy-aaa" });

      const result = await caller.deploy.createPreview({
        app: "App 1",
        host: "preview-app1.alfred.local",
        authz: "token",
        build: {
          context: "/tmp/ctx",
          port: 3000,
          env: { FOO: "bar" },
        },
      });

      expect(toolDockerExecuteMock).toHaveBeenCalled();
      expect(toolRouterExecuteMock).toHaveBeenCalledWith({
        input: expect.objectContaining({
          action: "register",
          host: "preview-app1.alfred.local",
          tls: true,
          authz: "token",
        }),
      });
      expect(upsertDeploymentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          app: "App 1",
          type: "preview",
          status: "running",
          domain: "preview-app1.alfred.local",
        })
      );
      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          host: "preview-app1.alfred.local",
          url: "https://preview-app1.alfred.local",
          deploymentId: "deploy-aaa",
          upstream: expect.stringMatching(/^http:\/\/127\.0\.0\.1:/),
        })
      );
    });

    it("skips build/run when upstream + image are provided", async () => {
      toolDockerExecuteMock.mockResolvedValue({ ok: true });
      toolRouterExecuteMock.mockResolvedValue({ ok: true });
      upsertDeploymentMock.mockResolvedValue({ id: "deploy-bbb" });

      const result = await caller.deploy.createPreview({
        app: "app1",
        host: "preview-app1.alfred.local",
        upstream: "http://localhost:3001",
        authz: "token",
        build: {
          context: "/tmp/ctx",
          image: "my-image:latest",
        },
      });

      const dockerActions = toolDockerExecuteMock.mock.calls
        .map(([arg]) => arg?.input?.action)
        .filter(Boolean);
      expect(dockerActions).toEqual([]);

      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          upstream: "http://localhost:3001",
          deploymentId: "deploy-bbb",
        })
      );
    });

    it("rolls back container when route registration fails", async () => {
      toolDockerExecuteMock.mockImplementation(async ({ input }) => {
        if (input.action === "build") {
          return { ok: true };
        }
        if (input.action === "run") {
          return {
            details: {
              name: "preview_app1_aaaaaa",
              containerId: "container-123",
              hostPort: 30_080,
            },
          };
        }
        if (input.action === "stop" || input.action === "rm") {
          return { ok: true };
        }
        throw new Error("unexpected_docker_action");
      });
      toolRouterExecuteMock.mockImplementation(async ({ input }) => {
        if (input.action === "register") {
          throw new Error("router_register_failed");
        }
        return { ok: true };
      });

      await expect(
        caller.deploy.createPreview({
          app: "app1",
          host: "preview-app1.alfred.local",
          authz: "token",
          build: { context: "/tmp/ctx" },
        })
      ).rejects.toThrow();

      const dockerInputs = toolDockerExecuteMock.mock.calls.map(
        ([arg]) => arg.input as { action: string; name?: string }
      );
      expect(dockerInputs.some((c) => c.action === "stop")).toBe(true);
      expect(dockerInputs.some((c) => c.action === "rm")).toBe(true);
      expect(setDeploymentStatusMock).not.toHaveBeenCalled();
    });

    it("rolls back route + container when deployment record upsert fails", async () => {
      toolDockerExecuteMock.mockImplementation(async ({ input }) => {
        if (input.action === "build") {
          return { ok: true };
        }
        if (input.action === "run") {
          return {
            details: {
              name: "preview_app1_aaaaaa",
              containerId: "container-123",
              hostPort: 30_080,
            },
          };
        }
        if (input.action === "stop" || input.action === "rm") {
          return { ok: true };
        }
        throw new Error("unexpected_docker_action");
      });
      toolRouterExecuteMock.mockImplementation(async ({ input }) => {
        if (input.action === "register" || input.action === "remove") {
          return { ok: true };
        }
        throw new Error("unexpected_router_action");
      });
      upsertDeploymentMock.mockRejectedValue(new Error("db_failed"));

      await expect(
        caller.deploy.createPreview({
          app: "app1",
          host: "preview-app1.alfred.local",
          authz: "token",
          build: { context: "/tmp/ctx" },
        })
      ).rejects.toThrow();

      const routerActions = toolRouterExecuteMock.mock.calls.map(
        ([arg]) => arg.input.action as string
      );
      expect(routerActions).toContain("remove");
      expect(setDeploymentStatusMock).not.toHaveBeenCalled();
    });

    it("validates build.port range", async () => {
      await expect(
        caller.deploy.createPreview({
          app: "app1",
          host: "preview-app1.alfred.local",
          authz: "token",
          build: { context: "/tmp/ctx", port: 0 },
        })
      ).rejects.toThrow();
    });

    it("rejects policy deny decisions", async () => {
      evaluateMock.mockResolvedValueOnce({ allow: false, reason: "nope" });
      await expect(
        caller.deploy.createPreview({
          app: "app1",
          host: "preview-app1.alfred.local",
          authz: "token",
          build: { context: "/tmp/ctx" },
        })
      ).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe("promote", () => {
    it("promotes upstream to production and removes preview", async () => {
      toolDockerExecuteMock.mockResolvedValue({ ok: true });
      toolRouterExecuteMock.mockResolvedValue({ ok: true });
      getDeploymentByAppMock.mockResolvedValue({
        id: "deploy-prev",
        userId: "test-user",
        app: "app1",
        type: "preview",
        status: "running",
        domain: "preview-app1.alfred.local",
      });
      upsertDeploymentMock.mockResolvedValue({ id: "deploy-prod" });

      const result = await caller.deploy.promote({
        app: "app1",
        upstream: "http://localhost:3000",
        authz: "token",
      });

      expect(toolDockerExecuteMock).toHaveBeenCalledWith({
        input: expect.objectContaining({
          action: "exec.probe",
          url: "http://localhost:3000",
          authz: "token",
        }),
      });
      expect(toolRouterExecuteMock).toHaveBeenCalledWith({
        input: expect.objectContaining({
          action: "register",
          tls: true,
          authz: "token",
        }),
      });
      expect(setDeploymentStatusMock).toHaveBeenCalledWith(
        "deploy-prev",
        "removed",
        expect.objectContaining({
          metadata: expect.objectContaining({ stage: "promote" }),
        })
      );
      expect(recordHealthCheckMock).toHaveBeenCalledWith(
        "deploy-prod",
        "healthy",
        expect.any(Object)
      );
      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          url: expect.stringMatching(/^https:\/\//),
        })
      );
    });

    it("rejects policy deny decisions", async () => {
      evaluateMock.mockResolvedValueOnce({ allow: false, reason: "nope" });
      await expect(
        caller.deploy.promote({
          app: "app1",
          upstream: "http://localhost:3000",
          authz: "token",
        })
      ).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe("probe", () => {
    it("probes a deployment", async () => {
      getDeploymentByAppMock.mockResolvedValue({
        id: "deploy-prev",
        userId: "test-user",
        app: "app1",
        type: "preview",
        status: "running",
        domain: "preview-app1.alfred.local",
      });

      const result = await caller.deploy.probe({
        app: "app1",
        preview: true,
        authz: "token",
      });

      expect(deployService.probeDeployment).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          app: "app1",
          type: "preview",
          status: "healthy",
        })
      );
    });

    it("throws NOT_FOUND when deployment missing", async () => {
      getDeploymentByAppMock.mockResolvedValue(null);
      await expect(
        caller.deploy.probe({
          app: "missing",
          preview: true,
          authz: "token",
        })
      ).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe("healthStream", () => {
    it("streams health checks for filtered apps", async () => {
      listDeploymentsMock.mockResolvedValue([
        {
          id: "deploy-1",
          userId: "test-user",
          app: "app1",
          type: "preview",
          status: "running",
          domain: "preview-app1.alfred.local",
        },
        {
          id: "deploy-2",
          userId: "test-user",
          app: "app2",
          type: "preview",
          status: "running",
          domain: "preview-app2.alfred.local",
        },
      ]);
      (deployService.probeDeployment as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          status: "healthy",
          url: "http://127.0.0.1:3000",
          ts: "2025-01-01T00:00:00.000Z",
        })
        .mockResolvedValueOnce({
          status: "unhealthy",
          url: "http://127.0.0.1:3001",
          ts: "2025-01-01T00:00:01.000Z",
        });

      const sub = await caller.deploy.healthStream({
        apps: ["app1"],
        preview: true,
        intervalMs: 1000,
        authz: "token",
      });
      const observable = toObservable(sub);

      const first = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 1_000);
        const unsub = observable.subscribe({
          next: (v: unknown) => {
            clearTimeout(timeout);
            resolve(v);
            if (typeof unsub === "function") {
              unsub();
            } else {
              unsub.unsubscribe();
            }
          },
          error: (err: unknown) => {
            clearTimeout(timeout);
            reject(err);
          },
        });
      });

      expect(first).toEqual(
        expect.objectContaining({
          app: "app1",
        })
      );
      expect(listDeploymentsMock).toHaveBeenCalledWith(
        expect.objectContaining({ app: "app1", type: "preview" })
      );
    });

    it("emits error when a TRPCError is thrown during tick", async () => {
      listDeploymentsMock.mockResolvedValue([
        {
          id: "deploy-1",
          userId: "test-user",
          app: "app1",
          type: "preview",
          status: "running",
          domain: "preview-app1.alfred.local",
        },
      ]);
      (deployService.probeDeployment as unknown as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new TRPCError({ code: "INTERNAL_SERVER_ERROR" }));

      const sub = await caller.deploy.healthStream({
        apps: ["app1"],
        preview: true,
        intervalMs: 1000,
        authz: "token",
      });
      const observable = toObservable(sub);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 1_000);
        let unsub:
          | (() => void)
          | {
              unsubscribe: () => void;
            };
        unsub = observable.subscribe({
          next: (v: unknown) => {
            clearTimeout(timeout);
            if (typeof unsub === "function") {
              unsub();
            } else {
              unsub.unsubscribe();
            }
            reject(new Error(`expected_error_got_next:${JSON.stringify(v)}`));
          },
          error: (err: unknown) => {
            clearTimeout(timeout);
            if (typeof unsub === "function") {
              unsub();
            } else {
              unsub.unsubscribe();
            }
            try {
              expect(err).toBeInstanceOf(TRPCError);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
        });
      });
    });

    it("emits internal/unknown status when a non-TRPC error occurs", async () => {
      listDeploymentsMock.mockResolvedValue([
        {
          id: "deploy-1",
          userId: "test-user",
          app: "app1",
          type: "preview",
          status: "running",
          domain: "preview-app1.alfred.local",
        },
      ]);
      (deployService.probeDeployment as unknown as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("boom"));

      const sub = await caller.deploy.healthStream({
        apps: ["app1"],
        preview: true,
        intervalMs: 1000,
        authz: "token",
      });
      const observable = toObservable(sub);

      const ev = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 1_000);
        const unsub = observable.subscribe({
          next: (v: unknown) => {
            clearTimeout(timeout);
            resolve(v);
            if (typeof unsub === "function") {
              unsub();
            } else {
              unsub.unsubscribe();
            }
          },
          error: (err: unknown) => {
            clearTimeout(timeout);
            reject(err);
          },
        });
      });

      expect(ev).toEqual(
        expect.objectContaining({
          app: "internal",
          status: "unknown",
        })
      );
    });
  });

  describe("remove", () => {
    it("removes a preview deployment and stops its container", async () => {
      toolDockerExecuteMock.mockImplementation(async ({ input }) => {
        if (input.action === "stop" || input.action === "rm") {
          return { ok: true };
        }
        return { ok: true };
      });
      toolRouterExecuteMock.mockResolvedValue({ ok: true });
      getDeploymentByAppMock.mockResolvedValue({
        id: "deploy-prev",
        userId: "test-user",
        app: "app1",
        type: "preview",
        status: "running",
        domain: "preview-app1.alfred.local",
        containerName: "cname",
        containerId: "cid",
      });

      const result = await caller.deploy.remove({
        app: "app1",
        preview: true,
        authz: "token",
      });

      expect(toolRouterExecuteMock).toHaveBeenCalledWith({
        input: expect.objectContaining({
          action: "remove",
          host: "preview-app1.alfred.local",
          authz: "token",
        }),
      });
      const dockerActions = toolDockerExecuteMock.mock.calls.map(
        ([arg]) => arg.input.action as string
      );
      expect(dockerActions).toContain("stop");
      expect(dockerActions).toContain("rm");
      expect(setDeploymentStatusMock).toHaveBeenCalledWith(
        "deploy-prev",
        "removed",
        expect.any(Object)
      );
      expect(result).toEqual({ ok: true });
    });

    it("removes a production deployment without stopping a container", async () => {
      toolDockerExecuteMock.mockResolvedValue({ ok: true });
      toolRouterExecuteMock.mockResolvedValue({ ok: true });
      getDeploymentByAppMock.mockResolvedValue({
        id: "deploy-prod",
        userId: "test-user",
        app: "app1",
        type: "production",
        status: "active",
        domain: "app1.alfred.local",
      });

      await caller.deploy.remove({
        app: "app1",
        preview: false,
        authz: "token",
      });

      const dockerActions = toolDockerExecuteMock.mock.calls.map(
        ([arg]) => arg.input.action as string
      );
      expect(dockerActions).toEqual([]);
    });

    it("rejects policy deny decisions", async () => {
      evaluateMock.mockResolvedValueOnce({ allow: false, reason: "nope" });
      await expect(
        caller.deploy.remove({
          app: "app1",
          preview: true,
          authz: "token",
        })
      ).rejects.toBeInstanceOf(TRPCError);
    });
  });
});
