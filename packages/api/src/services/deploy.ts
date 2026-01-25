import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";
import { toolRouter } from "@alfred/agent/orchestrator/tool/router";
import { deployRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { createServer } from "node:net";

const PREVIEW_BIND_HOST = "127.0.0.1";

function parsePortEnv(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PREVIEW_PORT_START = parsePortEnv(process.env.PREVIEW_PORT_START, 30_080);
const PREVIEW_PORT_END = parsePortEnv(process.env.PREVIEW_PORT_END, 30_200);

export function slugifyApp(app: string) {
  return app
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .replaceAll(/-{2,}/g, "-");
}

export function getAppDomain() {
  const domain = process.env.APP_DOMAIN?.trim();
  return domain && domain.length > 0 ? domain : "alfred.local";
}

export function buildPreviewHost(app: string, suffix: string, domain: string) {
  return `preview-${app}-${suffix}.${domain}`;
}

export function buildProdHost(app: string, domain: string) {
  return `${app}.${domain}`;
}

export async function allocatePort(
  rangeStart = PREVIEW_PORT_START,
  rangeEnd = PREVIEW_PORT_END,
  host = PREVIEW_BIND_HOST
): Promise<number> {
  const min = Math.min(rangeStart, rangeEnd);
  const max = Math.max(rangeStart, rangeEnd);

  for (let port = min; port <= max; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await new Promise<boolean>((resolve) => {
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

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "preview_port_unavailable",
  });
}

export async function safeRouterRemove(
  host: string | null | undefined,
  authz: string
) {
  if (!host) {
    return;
  }
  try {
    await toolRouter.execute({
      input: {
        action: "remove",
        host,
        authz,
      },
    });
  } catch (error) {
    // Best-effort cleanup - failures are expected if route doesn't exist
    logger.warn("router_remove_failed", {
      host,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function safeStopContainer(
  nameOrId: string | null | undefined,
  authz: string
) {
  if (!nameOrId) {
    return;
  }
  try {
    await toolDocker.execute({
      input: {
        action: "stop",
        name: nameOrId,
        authz,
      },
    });
  } catch (error) {
    // Container stop failures are expected if container doesn't exist
    logger.warn("container_stop_failed", {
      nameOrId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    await toolDocker.execute({
      input: {
        action: "rm",
        name: nameOrId,
        authz,
      },
    });
  } catch (error) {
    // Container remove failures are expected if container doesn't exist
    logger.warn("container_remove_failed", {
      nameOrId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface ProbeResult {
  status: "healthy" | "unhealthy" | "unknown";
  url: string | null;
  ts: string;
}

export type DeploymentRow = NonNullable<
  Awaited<ReturnType<typeof deployRepo.getDeploymentById>>
>;

export function resolveHealthUrl(record: DeploymentRow) {
  if (record.healthUrl && record.healthUrl.length > 0) {
    return record.healthUrl;
  }
  if (typeof record.port === "number" && record.port > 0) {
    return `http://${PREVIEW_BIND_HOST}:${record.port}`;
  }
  return null;
}

export async function probeDeployment({
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
    await deployRepo.recordHealthCheck(
      record.id,
      record.healthStatus ?? "unknown",
      {}
    );
    return {
      status: "unknown",
      url: null,
      ts: timestamp,
    };
  }

  if (!authz) {
    const fallbackStatus = (record.healthStatus ??
      "unknown") as ProbeResult["status"];
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
    await deployRepo.recordHealthCheck(record.id, "healthy", {
      healthUrl: url,
    });
    return {
      status: "healthy",
      url,
      ts: timestamp,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    await deployRepo.recordHealthCheck(record.id, "unhealthy", {
      healthUrl: url,
    });
    return {
      status: "unhealthy",
      url,
      ts: timestamp,
    };
  }
}

export const deployService = {
  PREVIEW_BIND_HOST,
  allocatePort,
  slugifyApp,
  getAppDomain,
  buildPreviewHost,
  buildProdHost,
  safeRouterRemove,
  safeStopContainer,
  resolveHealthUrl,
  probeDeployment,
};
