import { randomUUID } from "node:crypto";
import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";
import { toolRouter } from "@alfred/agent/orchestrator/tool/router";
import { deployRepo } from "@alfred/db";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import z from "zod";
import { requirePolicy } from "../gate";
import { deployService, type ProbeResult } from "../services/deploy";
import { authedProcedure, router } from "../trpc";

const listInput = z
  .object({
    app: z.string().min(1).optional(),
    type: z.enum(["preview", "production"]).optional(),
    status: z.string().min(1).optional(),
  })
  .optional();

const idInput = z.object({
  id: z.string().uuid(),
});

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

function mapDeployResource(raw: unknown, env: "preview" | "prod" | "remove") {
  const maybeApp =
    typeof (raw as { app?: unknown })?.app === "string"
      ? ((raw as { app?: string }).app as string)
      : "unknown";
  return {
    kind: "deploy",
    id: maybeApp,
    attrs: {
      env,
    },
  };
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
    { app: firstApp } as { app: string },
    data.preview === false ? "prod" : "preview"
  );
};

export const deployRouter: ReturnType<typeof router> = router({
  list: authedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const session = ctx.session;
    const userId = session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const deployments = await deployRepo.listDeployments({
      userId,
      app: input?.app,
      type: input?.type,
      status: input?.status,
    });
    return deployments;
  }),

  get: authedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const session = ctx.session;
    const userId = session?.user?.id;
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
      const session = ctx.session;
      const userId = session?.user?.id;
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
      const session = ctx.session;
      const userId = session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const domain = deployService.getAppDomain();
      const slug = deployService.slugifyApp(input.app);
      const suffix = randomUUID().slice(0, 6);
      const host = input.host ?? deployService.buildPreviewHost(slug, suffix, domain);

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
        await deployService.safeStopContainer(containerName ?? containerId, input.authz);
        if (deploymentId) {
          await deployRepo.setDeploymentStatus(deploymentId, "failed", {
            metadata: {
              failedAt: new Date().toISOString(),
            },
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
              ports?: Array<{ host: number; container: number }>;
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

          if (
            Array.isArray(runResult.details?.ports) &&
            runResult.details?.ports.length > 0
          ) {
            ports = runResult.details?.ports ?? null;
          } else if (hostPort !== null) {
            ports = [{ host: hostPort, container: input.build.port }];
          }

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

        const record = await deployRepo.upsertDeployment({
          userId,
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
    .use(requirePolicy("deploy.promote", mapPromoteResource))
    .input(promoteInput)
    .mutation(async ({ ctx, input }) => {
      // Handle policy obligations (e.g., biometric elevation)
      const obligations = ctx.policy?.obligations;
      if (obligations && obligations.length > 0) {
        // If the PDP returns obligations, it means the current session context
        // (even if valid) requires additional proof for this specific action.
        // We throw a specialized error that the client recognizes to trigger elevation.
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "obligation_required",
          cause: {
            reason: "deployment_promotion",
            obligations,
          },
        });
      }

      const domain = deployService.getAppDomain();
      const slug = deployService.slugifyApp(input.app);
      const host = input.host ?? deployService.buildProdHost(slug, domain);
      const session = ctx.session;
      const userId = session?.user?.id;
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

      return {
        ok: true as const,
        url: `https://${host}`,
        host,
      };
    }),

  probe: authedProcedure
    .use(requirePolicy("deploy.health", mapHealthResource))
    .input(probeInput)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      const userId = session?.user?.id;
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
        const session = ctx.session;
        const userId = session?.user?.id;
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
            : input.preview
              ? "preview"
              : "production";

        const shouldInclude = (app: string) =>
          appsFilter ? appsFilter.has(app) : true;

        const fetchDeployments = async () => {
          if (appsFilter && appsFilter.size === 1) {
            const [singleApp] = Array.from(appsFilter);
            return deployRepo.listDeployments({
              userId,
              app: singleApp,
              type: typeFilter,
            });
          }
          return deployRepo.listDeployments({
            userId,
            type: typeFilter,
          });
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
        timer = setInterval(() => {
          void tick();
        }, input.intervalMs);

        return () => {
          closed = true;
          if (timer) {
            clearInterval(timer);
          }
        };
      })
    ),

  remove: authedProcedure
    .use(requirePolicy("deploy.remove", mapRemoveResource))
    .input(removeInput)
    .mutation(async ({ ctx, input }) => {
      // Handle policy obligations
      const obligations = ctx.policy?.obligations;
      if (obligations && obligations.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "obligation_required",
          cause: {
            reason: "deployment_remove",
            obligations,
          },
        });
      }

      const session = ctx.session;
      const userId = session?.user?.id;
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
});
