import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";
import { toolRouter } from "@alfred/agent/orchestrator/tool/router";
import { deployRepo } from "@alfred/db";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "node:crypto";
import z from "zod";

import { PolicyObligationError } from "../errors";
import { requirePolicy } from "../gate";
import { deployService, type ProbeResult } from "../services/deploy";
import { authedProcedure, router } from "../trpc";
import {
  connectNetwork,
  createContainer,
  createNetwork,
  createVolume,
  disconnectNetwork,
  getContainerInspect,
  getContainerLogs,
  getContainerStats,
  listContainers,
  listNetworks,
  listVolumes,
  removeContainer,
  removeNetwork,
  removeVolume,
  startContainer,
  stopContainer,
} from "./deploy-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Input Schemas
// ─────────────────────────────────────────────────────────────────────────────

const listInput = z
  .object({
    app: z.string().min(1).optional(),
    type: z.enum(["preview", "production"]).optional(),
    status: z.string().min(1).optional(),
  })
  .optional();

const idInput = z.object({ id: z.string().uuid() });

const previewBuildInput = z.object({
  context: z.string().min(1),
  dockerfile: z.string().optional(),
  image: z.string().optional(),
  port: z.number().int().min(1).max(65_535).default(3000),
  env: z.record(z.string(), z.string()).optional(),
});

const createPreviewInput = z.object({
  app: z.string().min(1),
  build: previewBuildInput,
  host: z.string().optional(),
  upstream: z.string().url().optional(),
  authz: z.string().min(1),
  cw: z.string().optional(),
});

const promoteInput = z.object({
  app: z.string().min(1),
  host: z.string().optional(),
  upstream: z.string().url(),
  authz: z.string().min(1),
});

const removeInput = z.object({
  app: z.string().min(1),
  preview: z.boolean().default(true),
  authz: z.string().min(1),
});

const probeInput = z.object({
  app: z.string().min(1),
  preview: z.boolean().default(true),
  authz: z.string().min(1).optional(),
});

const healthStreamInput = z.object({
  apps: z.array(z.string().min(1)).optional(),
  preview: z.boolean().optional(),
  intervalMs: z.number().int().min(1000).max(60_000).default(5000),
  authz: z.string().min(1).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Resource Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapDeployResource(raw: unknown, env: "preview" | "prod" | "remove") {
  const maybeApp =
    typeof (raw as { app?: unknown })?.app === "string"
      ? ((raw as { app?: string }).app as string)
      : "unknown";
  return { kind: "deploy", id: maybeApp, attrs: { env } };
}

const mapPreviewResource = (raw: unknown) => mapDeployResource(raw, "preview");
const mapPromoteResource = (raw: unknown) => mapDeployResource(raw, "prod");
const mapRemoveResource = (raw: unknown) => mapDeployResource(raw, "remove");
const mapHealthResource = (raw: unknown) => {
  const data = raw as { app?: string; apps?: string[]; preview?: boolean };
  let firstApp = "all";
  if (typeof data.app === "string") {
    firstApp = data.app;
  } else if (Array.isArray(data.apps) && data.apps.length > 0) {
    const possibleApp = data.apps[0];
    if (possibleApp) {
      firstApp = possibleApp;
    }
  }
  return mapDeployResource(
    { app: firstApp },
    data.preview === false ? "prod" : "preview"
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export const deployRouter = router({
  list: authedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return await deployRepo.listDeployments({
      userId,
      app: input?.app,
      type: input?.type,
      status: input?.status,
    });
  }),

  get: authedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const deployment = await deployRepo.getDeploymentById(input.id);
    if (!deployment || deployment.userId !== userId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "deployment_not_found",
      });
    }
    return deployment;
  }),

  removeRecord: authedProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const deployment = await deployRepo.getDeploymentById(input.id);
      if (!deployment || deployment.userId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "deployment_not_found",
        });
      }
      await deployRepo.setDeploymentStatus(input.id, "removed", {
        metadata: {
          removedBy: userId,
          removedAt: new Date().toISOString(),
          mode: "record-only",
        },
      });
      return { ok: true } as const;
    }),

  createPreview: authedProcedure
    .use(requirePolicy("deploy.preview", mapPreviewResource))
    .input(createPreviewInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const domain = deployService.getAppDomain();
      const slug = deployService.slugifyApp(input.app);
      const suffix = randomUUID().slice(0, 6);
      const host =
        input.host ?? deployService.buildPreviewHost(slug, suffix, domain);

      let upstream = input.upstream ?? null;
      let hostPort: number | null = null;
      let containerName: string | null = null;
      let containerId: string | null = null;
      let ports: Array<{ host: number; container: number }> | null = null;
      const imageTag =
        input.build.image ?? `alfred/preview-${slug}-${Date.now()}`;
      let deploymentId: string | null = null;
      let routeRegistered = false;

      const cleanup = async () => {
        if (routeRegistered) {
          await deployService.safeRouterRemove(host, input.authz);
        }
        await deployService.safeStopContainer(
          containerName ?? containerId,
          input.authz
        );
        if (deploymentId) {
          await deployRepo.setDeploymentStatus(deploymentId, "failed", {
            metadata: { failedAt: new Date().toISOString() },
          });
        }
      };

      try {
        if (!input.build.image) {
          await toolDocker.execute({
            input: {
              action: "build",
              cw: input.cw,
              context: input.build.context,
              dockerfile: input.build.dockerfile,
              tag: imageTag,
              authz: input.authz,
            },
          });
        }

        if (!upstream) {
          hostPort = await deployService.allocatePort();
          const runName = `preview_${slug}_${suffix}`;
          const runResult = (await toolDocker.execute({
            input: {
              action: "run",
              name: runName,
              tag: imageTag,
              containerPort: input.build.port,
              hostPort,
              env: input.build.env,
              network: process.env.DOCKER_NETWORK,
              authz: input.authz,
            },
          })) as {
            details?: {
              name?: string;
              containerId?: string;
              hostPort?: number | null;
              ports?: { host: number; container: number }[];
            };
          };

          containerName = runResult.details?.name ?? runName ?? null;
          containerId = runResult.details?.containerId ?? null;
          const resolvedHostPort =
            typeof runResult.details?.hostPort === "number"
              ? runResult.details?.hostPort
              : (hostPort ?? null);
          if (resolvedHostPort !== null) {
            hostPort = resolvedHostPort;
          }

          ports =
            Array.isArray(runResult.details?.ports) &&
            runResult.details?.ports.length > 0
              ? (runResult.details?.ports ?? null)
              : (hostPort !== null
                ? [{ host: hostPort, container: input.build.port }]
                : null);

          upstream = `http://${deployService.PREVIEW_BIND_HOST}:${hostPort}`;
        }

        if (!upstream) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "preview_upstream_unavailable",
          });
        }

        await toolRouter.execute({
          input: {
            action: "register",
            host,
            upstream,
            tls: true,
            authz: input.authz,
          },
        });
        routeRegistered = true;

        const projectId = await (async () => {
          const url = process.env.DATABASE_URL;
          if (!url || url.startsWith("sqlite")) {
            return;
          }
          const cw = typeof input.cw === "string" ? input.cw.trim() : "";
          if (!cw) {
            return;
          }
          try {
            const { detectProject } = await import("@alfred/plan");
            const project = await detectProject(cw, userId);
            return project.id;
          } catch {
            return;
          }
        })();

        const record = await deployRepo.upsertDeployment({
          userId,
          projectId,
          app: input.app,
          type: "preview",
          status: "running",
          domain: host,
          url: `https://${host}`,
          containerName: containerName ?? null,
          containerId: containerId ?? null,
          port: hostPort ?? null,
          ports: ports ?? null,
          healthUrl: upstream,
          metadata: {
            image: imageTag,
            env: input.build.env ?? null,
            createdBy: userId,
            upstream,
          },
        });
        deploymentId = record.id;

        return {
          ok: true as const,
          url: `https://${host}`,
          host,
          upstream,
          deploymentId: record.id,
        };
      } catch (error) {
        await cleanup();
        throw error;
      }
    }),

  promote: authedProcedure
    .use(
      requirePolicy("deploy.promote", mapPromoteResource, undefined, {
        handleObligations: "passThrough",
      })
    )
    .input(promoteInput)
    .mutation(async ({ ctx, input }) => {
      const obligations = ctx.policy?.obligations;
      if (obligations && obligations.length > 0) {
        throw new PolicyObligationError("deploy.promote", obligations, {
          reason: "deployment_promotion",
        });
      }

      const domain = deployService.getAppDomain();
      const slug = deployService.slugifyApp(input.app);
      const host = input.host ?? deployService.buildProdHost(slug, domain);
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await toolDocker.execute({
        input: {
          action: "exec.probe",
          url: input.upstream,
          timeoutSec: 15,
          authz: input.authz,
        },
      });

      await toolRouter.execute({
        input: {
          action: "register",
          host,
          upstream: input.upstream,
          tls: true,
          authz: input.authz,
        },
      });

      const preview = await deployRepo.getDeploymentByApp(
        userId,
        input.app,
        "preview"
      );

      if (preview?.projectId) {
        const url = process.env.DATABASE_URL;
        if (url && !url.startsWith("sqlite")) {
          const { projectId } = preview;
          await import("@alfred/db/repo/project")
            .then((repo) => repo.updateProjectLastActive(projectId))
            .catch(() => {});
        }
      }
      if (preview?.domain) {
        await deployService.safeRouterRemove(preview.domain, input.authz);
      }
      if (preview?.id) {
        await deployRepo.setDeploymentStatus(preview.id, "removed", {
          metadata: {
            removedAt: new Date().toISOString(),
            removedBy: userId,
            stage: "promote",
          },
        });
      }

      const record = await deployRepo.upsertDeployment({
        userId,
        projectId: preview?.projectId ?? null,
        app: input.app,
        type: "production",
        status: "active",
        domain: host,
        url: `https://${host}`,
        healthUrl: input.upstream,
        metadata: {
          promotedFrom: preview?.domain ?? null,
          promotedAt: new Date().toISOString(),
        },
      });

      await deployRepo.recordHealthCheck(record.id, "healthy", {
        healthUrl: input.upstream,
      });
      return { ok: true as const, url: `https://${host}`, host };
    }),

  probe: authedProcedure
    .use(requirePolicy("deploy.health", mapHealthResource))
    .input(probeInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const deployment = await deployRepo.getDeploymentByApp(
        userId,
        input.app,
        input.preview ? "preview" : "production"
      );
      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "deployment_not_found",
        });
      }
      const result = await deployService.probeDeployment({
        record: deployment,
        authz: input.authz,
      });
      return {
        app: deployment.app,
        type: deployment.type,
        status: result.status,
        url: result.url,
        ts: result.ts,
      };
    }),

  healthStream: authedProcedure
    .use(requirePolicy("deploy.health", mapHealthResource))
    .input(healthStreamInput)
    .subscription(({ ctx, input }) =>
      observable<{
        app: string;
        type: "preview" | "production";
        status: "healthy" | "unhealthy" | "unknown";
        url: string | null;
        ts: string;
      }>((emit) => {
        const userId = ctx.session?.user?.id;
        if (!userId) {
          emit.error(new TRPCError({ code: "UNAUTHORIZED" }));
          return () => {};
        }

        let closed = false;
        let running = false;
        const appsFilter = input.apps ? new Set(input.apps) : null;
        const typeFilter =
          input.preview === undefined
            ? undefined
            : (input.preview
              ? "preview"
              : "production");

        const shouldInclude = (app: string) =>
          appsFilter ? appsFilter.has(app) : true;

        const fetchDeployments = () => {
          if (appsFilter && appsFilter.size === 1) {
            const [singleApp] = [...appsFilter];
            return deployRepo.listDeployments({
              userId,
              app: singleApp,
              type: typeFilter,
            });
          }
          return deployRepo.listDeployments({ userId, type: typeFilter });
        };

        let timer: ReturnType<typeof setInterval> | null = null;

        const tick = async () => {
          if (running || closed) {
            return;
          }
          running = true;
          try {
            const deployments = await fetchDeployments();
            for (const record of deployments) {
              if (!shouldInclude(record.app)) {
                continue;
              }
              const result = await deployService.probeDeployment({
                record,
                authz: input.authz,
              });
              emit.next({
                app: record.app,
                type: (record.type === "production"
                  ? "production"
                  : "preview") as "preview" | "production",
                status: result.status as ProbeResult["status"],
                url: result.url,
                ts: result.ts,
              });
            }
          } catch (error) {
            if (error instanceof TRPCError) {
              if (!closed) {
                emit.error(error);
              }
              closed = true;
              if (timer) {
                clearInterval(timer);
              }
              return;
            }
            emit.next({
              app: "internal",
              type: "preview",
              status: "unknown",
              url: null,
              ts: new Date().toISOString(),
            });
          } finally {
            running = false;
          }
        };

        void tick();
        timer = setInterval(() => void tick(), input.intervalMs);
        return () => {
          closed = true;
          if (timer) {
            clearInterval(timer);
          }
        };
      })
    ),

  remove: authedProcedure
    .use(
      requirePolicy("deploy.remove", mapRemoveResource, undefined, {
        handleObligations: "passThrough",
      })
    )
    .input(removeInput)
    .mutation(async ({ ctx, input }) => {
      const obligations = ctx.policy?.obligations;
      if (obligations && obligations.length > 0) {
        throw new PolicyObligationError("deploy.remove", obligations, {
          reason: "deployment_remove",
        });
      }

      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const type = input.preview ? "preview" : "production";
      const record = await deployRepo.getDeploymentByApp(
        userId,
        input.app,
        type
      );
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "deployment_not_found",
        });
      }

      await deployService.safeRouterRemove(record.domain, input.authz);
      if (type === "preview") {
        await deployService.safeStopContainer(
          record.containerName ?? record.containerId,
          input.authz
        );
      }

      await deployRepo.setDeploymentStatus(record.id, "removed", {
        metadata: {
          removedAt: new Date().toISOString(),
          removedBy: userId,
          mode: input.preview ? "preview-remove" : "prod-remove",
        },
      });
      return { ok: true } as const;
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Container Management Procedures (delegating to helpers)
  // ─────────────────────────────────────────────────────────────────────────

  containersList: authedProcedure
    .input(
      z.object({ filter: z.enum(["all", "running", "agent"]).default("all") })
    )
    .query(async ({ input }) => {
      const containers = await listContainers(input.filter);
      return { containers };
    }),

  containersStats: authedProcedure
    .input(z.object({ containerId: z.string() }))
    .query(async ({ input }) => getContainerStats(input.containerId)),

  containersLogs: authedProcedure
    .input(
      z.object({
        containerId: z.string(),
        tail: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input }) => {
      const logs = await getContainerLogs(input.containerId, input.tail);
      return { logs };
    }),

  containersStart: authedProcedure
    .input(z.object({ containerId: z.string(), authz: z.string().optional() }))
    .mutation(async ({ input }) => ({
      success: await startContainer(input.containerId, input.authz),
    })),

  containersStop: authedProcedure
    .input(z.object({ containerId: z.string(), authz: z.string().optional() }))
    .mutation(async ({ input }) => ({
      success: await stopContainer(input.containerId, input.authz),
    })),

  containersRemove: authedProcedure
    .input(z.object({ containerId: z.string(), authz: z.string().optional() }))
    .mutation(async ({ input }) => ({
      success: await removeContainer(input.containerId, input.authz),
    })),

  containersInspect: authedProcedure
    .input(z.object({ containerId: z.string() }))
    .query(async ({ input }) => getContainerInspect(input.containerId)),

  containersCreate: authedProcedure
    .input(
      z.object({
        image: z.string().min(1),
        name: z.string().min(1).optional(),
        ports: z
          .array(
            z.object({
              host: z.number().int().min(1).max(65_535),
              container: z.number().int().min(1).max(65_535),
            })
          )
          .optional(),
        env: z.record(z.string(), z.string()).optional(),
        network: z.string().min(1).optional(),
        volumes: z.array(z.string().min(1)).optional(),
        cmd: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => createContainer(input)),

  networksList: authedProcedure.query(async () => ({
    networks: await listNetworks(),
  })),

  networksCreate: authedProcedure
    .input(z.object({ name: z.string().min(1), driver: z.string().optional() }))
    .mutation(async ({ input }) => createNetwork(input)),

  networksRemove: authedProcedure
    .input(z.object({ nameOrId: z.string().min(1) }))
    .mutation(async ({ input }) => ({
      success: await removeNetwork(input.nameOrId),
    })),

  networksConnect: authedProcedure
    .input(
      z.object({ network: z.string().min(1), containerId: z.string().min(1) })
    )
    .mutation(async ({ input }) => ({
      success: await connectNetwork({
        network: input.network,
        container: input.containerId,
      }),
    })),

  networksDisconnect: authedProcedure
    .input(
      z.object({
        network: z.string().min(1),
        containerId: z.string().min(1),
        force: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => ({
      success: await disconnectNetwork({
        network: input.network,
        container: input.containerId,
        force: input.force,
      }),
    })),

  volumesList: authedProcedure.query(async () => ({
    volumes: await listVolumes(),
  })),

  volumesCreate: authedProcedure
    .input(z.object({ name: z.string().min(1), driver: z.string().optional() }))
    .mutation(async ({ input }) => ({
      success: await createVolume(input),
    })),

  volumesRemove: authedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => ({
      success: await removeVolume(input.name),
    })),
});
