import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";
import { toolRouter } from "@alfred/agent/orchestrator/tool/router";
import { deployRepo } from "@alfred/db";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import z from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const PREVIEW_BIND_HOST = "127.0.0.1";

function parsePortEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PREVIEW_PORT_START = parsePortEnv(process.env.PREVIEW_PORT_START, 30080);
const PREVIEW_PORT_END = parsePortEnv(process.env.PREVIEW_PORT_END, 30200);

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
  port: z.number().int().min(1).max(65535).default(3000),
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
  intervalMs: z.number().int().min(1_000).max(60_000).default(5_000),
  authz: z.string().min(1).optional(),
});

function slugifyApp(app: string) {
  return app
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getAppDomain() {
  const domain = process.env.APP_DOMAIN?.trim();
  return domain && domain.length > 0 ? domain : "alfred.local";
}

function buildPreviewHost(app: string, suffix: string, domain: string) {
  return `preview-${app}-${suffix}.${domain}`;
}

function buildProdHost(app: string, domain: string) {
  return `${app}.${domain}`;
}

async function allocatePort(rangeStart: number, rangeEnd: number, host = PREVIEW_BIND_HOST): Promise<number> {
  const min = Math.min(rangeStart, rangeEnd);
  const max = Math.max(rangeStart, rangeEnd);

  for (let port = min; port <= max; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await new Promise<boolean>(resolve => {
      const server = createServer();
      const finalize = (result: boolean) => {
        server.removeAllListeners();
        resolve(result);
      };
      server.once("error", () => finalize(false));
      server.once("listening", () => {
        server.close(() => finalize(true));
      });
      server.listen(port, host);
    });

    if (available) {
      return port;
    }
  }

  throw new Error("preview_port_unavailable");
}

async function safeRouterRemove(host: string | null | undefined, authz: string) {
  if (!host) return;
  try {
    await toolRouter.execute({
      input: {
        action: "remove",
        host,
        authz,
      },
    });
  } catch {
    // best-effort cleanup
  }
}

async function safeStopContainer(nameOrId: string | null | undefined, authz: string) {
  if (!nameOrId) return;
  try {
    await toolDocker.execute({
      input: {
        action: "stop",
        name: nameOrId,
        authz,
      },
    });
  } catch {
    // ignore
  }
  try {
    await toolDocker.execute({
      input: {
        action: "rm",
        name: nameOrId,
        authz,
      },
    });
  } catch {
    // ignore
  }
}

function mapDeployResource(raw: unknown, env: "preview" | "prod" | "remove") {
  const maybeApp = typeof (raw as { app?: unknown })?.app === "string" ? ((raw as { app?: string }).app as string) : "unknown";
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
  const firstApp = typeof data.app === "string" ? data.app : Array.isArray(data.apps) && data.apps.length > 0 ? data.apps[0]! : "all";
  return mapDeployResource({ app: firstApp } as { app: string }, data.preview === false ? "prod" : "preview");
};

type DeploymentRow = NonNullable<Awaited<ReturnType<typeof deployRepo.getDeploymentById>>>;

type ProbeResult = {
  status: "healthy" | "unhealthy" | "unknown";
  url: string | null;
  ts: string;
};

function resolveHealthUrl(record: DeploymentRow) {
  if (record.healthUrl && record.healthUrl.length > 0) {
    return record.healthUrl;
  }
  if (typeof record.port === "number" && record.port > 0) {
    return `http://${PREVIEW_BIND_HOST}:${record.port}`;
  }
  return null;
}

async function probeDeployment({
  record,
  authz,
  timeoutSec = 15,
}: {
  record: DeploymentRow;
  authz?: string;
  timeoutSec?: number;
}): Promise<ProbeResult> {
  const url = resolveHealthUrl(record);
  const timestamp = new Date().toISOString();

  if (!url) {
    await deployRepo.recordHealthCheck(record.id, record.healthStatus ?? "unknown", {});
    return {
      status: "unknown",
      url: null,
      ts: timestamp,
    };
  }

  if (!authz) {
    const fallbackStatus = (record.healthStatus ?? "unknown") as ProbeResult["status"];
    return {
      status: fallbackStatus,
      url,
      ts: timestamp,
    };
  }

  try {
    await toolDocker.execute({
      input: {
        action: "exec.probe",
        url,
        timeoutSec,
        authz,
      },
    });
    await deployRepo.recordHealthCheck(record.id, "healthy", { healthUrl: url });
    return {
      status: "healthy",
      url,
      ts: timestamp,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    await deployRepo.recordHealthCheck(record.id, "unhealthy", { healthUrl: url });
    return {
      status: "unhealthy",
      url,
      ts: timestamp,
    };
  }
}

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
      throw new TRPCError({ code: "NOT_FOUND", message: "deployment_not_found" });
    }
    return deployment;
  }),

  removeRecord: authedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const session = ctx.session;
    const userId = session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const deployment = await deployRepo.getDeploymentById(input.id);
    if (!deployment || deployment.userId !== userId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "deployment_not_found" });
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
      const domain = getAppDomain();
      const slug = slugifyApp(input.app);
      const suffix = randomUUID().slice(0, 6);
      const host = input.host ?? buildPreviewHost(slug, suffix, domain);

      let upstream = input.upstream ?? null;
      let hostPort: number | null = null;
      let containerName: string | null = null;
      let containerId: string | null = null;
      let ports: Array<{ host: number; container: number }> | null = null;
      const imageTag = input.build.image ?? `alfred/preview-${slug}-${Date.now()}`;
      let deploymentId: string | null = null;
      let routeRegistered = false;

      const cleanup = async () => {
        if (routeRegistered) {
          await safeRouterRemove(host, input.authz);
        }
        await safeStopContainer(containerName ?? containerId, input.authz);
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
          hostPort = await allocatePort(PREVIEW_PORT_START, PREVIEW_PORT_END);
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

          containerName = (runResult.details?.name ?? runName) ?? null;
          containerId = runResult.details?.containerId ?? null;
          const resolvedHostPort =
            typeof runResult.details?.hostPort === "number" ? runResult.details?.hostPort : hostPort ?? null;
          if (resolvedHostPort !== null) {
            hostPort = resolvedHostPort;
          }

          if (Array.isArray(runResult.details?.ports) && runResult.details?.ports.length > 0) {
            ports = runResult.details?.ports ?? null;
          } else if (hostPort !== null) {
            ports = [{ host: hostPort, container: input.build.port }];
          }

          upstream = `http://${PREVIEW_BIND_HOST}:${hostPort}`;
        }

        if (!upstream) {
          throw new Error("preview_upstream_unavailable");
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
      // TODO: Handle policy obligations (e.g., biometric elevation) by pausing the request and resuming once satisfied.
      const domain = getAppDomain();
      const slug = slugifyApp(input.app);
      const host = input.host ?? buildProdHost(slug, domain);
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

      const preview = await deployRepo.getDeploymentByApp(userId, input.app, "preview");
      if (preview?.domain) {
        await safeRouterRemove(preview.domain, input.authz);
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
      const deployment = await deployRepo.getDeploymentByApp(userId, input.app, input.preview ? "preview" : "production");
      if (!deployment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "deployment_not_found" });
      }
      const result = await probeDeployment({ record: deployment, authz: input.authz });
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
      }>(emit => {
        const session = ctx.session;
        const userId = session?.user?.id;
        if (!userId) {
          emit.error(new TRPCError({ code: "UNAUTHORIZED" }));
          return () => {};
        }

        let closed = false;
        let running = false;
        const appsFilter = input.apps ? new Set(input.apps) : null;
        const typeFilter = input.preview === undefined ? undefined : input.preview ? "preview" : "production";

        const shouldInclude = (app: string) => (appsFilter ? appsFilter.has(app) : true);

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
          if (running || closed) return;
          running = true;
          try {
            const deployments = await fetchDeployments();
            for (const record of deployments) {
              if (!shouldInclude(record.app)) continue;
              const result = await probeDeployment({ record, authz: input.authz });
              emit.next({
                app: record.app,
                type: (record.type === "production" ? "production" : "preview") as "preview" | "production",
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
              if (timer) clearInterval(timer);
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
          if (timer) clearInterval(timer);
        };
      }),
    ),

  remove: authedProcedure
    .use(requirePolicy("deploy.remove", mapRemoveResource))
    .input(removeInput)
    .mutation(async ({ ctx, input }) => {
      // TODO: Surface PDP obligations and expose resumable workflow hooks before destructive teardown.
      const session = ctx.session;
      const userId = session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const type = input.preview ? "preview" : "production";
      const record = await deployRepo.getDeploymentByApp(userId, input.app, type);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "deployment_not_found" });
      }

      await safeRouterRemove(record.domain, input.authz);

      if (type === "preview") {
        await safeStopContainer(record.containerName ?? record.containerId, input.authz);
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
