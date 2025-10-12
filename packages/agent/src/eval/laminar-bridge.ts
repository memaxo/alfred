import { Laminar, LaminarClient, observe } from "@lmnr-ai/lmnr";
import { randomUUID } from "node:crypto";
import { recordLaminarDatapoint, recordLaminarError } from "../metrics";

export type LaminarMode = "sdk" | "api";

export interface LaminarEvalConfig {
  enabled: boolean;
  mode: LaminarMode;
  groupName?: string;
}

const projectApiKey = process.env.LMNR_PROJECT_API_KEY ?? process.env.LAMINAR_API_KEY ?? "";
const baseUrlRaw = process.env.LMNR_BASE_URL ?? process.env.LAMINAR_URL ?? undefined;
const httpPort = parsePort(process.env.LMNR_HTTP_PORT);
const grpcPort = parsePort(process.env.LMNR_GRPC_PORT);
const disableBatch = process.env.LMNR_TRACE_DISABLE_BATCH === "1";
const defaultMode: LaminarMode =
  process.env.EVAL_LAMINAR_MODE === "api" ? "api" : "sdk";
const defaultGroupName = process.env.EVAL_LAMINAR_GROUP;
const exportEnabledByDefault =
  process.env.EVAL_LAMINAR_EXPORT === "1" && Boolean(projectApiKey);

let clientCache: LaminarClient | null = null;

function parsePort(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function composeBaseUrl(base: string | undefined, port: number | undefined) {
  if (!base) return undefined;
  if (!port) return base;
  try {
    const url = new URL(base);
    url.port = String(port);
    return url.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

function getBaseHttpUrl() {
  return composeBaseUrl(baseUrlRaw ?? "https://api.lmnr.ai", httpPort);
}

function ensureClient() {
  if (!projectApiKey) return null;
  if (clientCache) return clientCache;
  clientCache = new LaminarClient({
    projectApiKey,
    baseUrl: composeBaseUrl(baseUrlRaw, grpcPort ?? httpPort),
    port: grpcPort ?? undefined,
  });
  return clientCache;
}

export async function initializeLaminar(): Promise<void> {
  if (!projectApiKey) {
    return;
  }
  try {
    if (typeof Laminar.initialized === "function" && Laminar.initialized()) {
      return;
    }
  } catch {
    // noop
  }

  try {
    Laminar.initialize({
      projectApiKey,
      baseUrl: baseUrlRaw,
      httpPort: httpPort ?? undefined,
      grpcPort: grpcPort ?? undefined,
      disableBatch,
      instrumentModules: undefined,
    });
  } catch {
    // Suppress initialization errors to avoid crashing startup; subsequent
    // calls will simply no-op.
  }
}

export function getLaminarEvalDefaults(): LaminarEvalConfig {
  return {
    enabled: exportEnabledByDefault,
    mode: defaultMode,
    groupName: defaultGroupName,
  };
}

export async function prepareLaminarEvalRun(
  name: string,
  metadata: Record<string, unknown> | undefined,
  config: LaminarEvalConfig,
) {
  if (!config.enabled || !projectApiKey) {
    return null;
  }

  const groupName = config.groupName ?? defaultGroupName;

  try {
    if (config.mode === "api") {
      const evalId = await createEvaluationViaApi(name, groupName, metadata);
      return evalId ? { evalId, mode: config.mode } : null;
    }

    const client = ensureClient();
    if (!client) return null;
    const evalId = await client.evals.create({
      name,
      groupName,
      metadata,
    });
    return { evalId, mode: config.mode };
  } catch (error) {
    recordLaminarError("create_eval");
    debugLog("Laminar evaluation creation failed", error);
    return null;
  }
}

export async function createLaminarDatapoint(
  evalId: string,
  point: {
    data: unknown;
    target?: unknown;
    metadata?: Record<string, unknown>;
    index: number;
  },
  traceId?: string | null,
  mode: LaminarMode = defaultMode,
) {
  if (!projectApiKey) return null;

  try {
    if (mode === "api") {
      const datapointId = await createDatapointViaApi(evalId, point, traceId);
      if (datapointId) {
        recordLaminarDatapoint("created");
      }
      return datapointId;
    }

    const client = ensureClient();
    if (!client) return null;
    const datapointId = await client.evals.createDatapoint({
      evalId,
      data: point.data,
      target: point.target,
      metadata: point.metadata,
      index: point.index,
      traceId: traceId ?? undefined,
    });
    recordLaminarDatapoint("created");
    return datapointId;
  } catch (error) {
    recordLaminarError("create_datapoint");
    debugLog("Laminar datapoint creation failed", error);
    return null;
  }
}

export async function updateLaminarDatapoint(
  evalId: string,
  datapointId: string,
  payload: {
    scores: Record<string, number>;
    executorOutput?: unknown;
  },
  mode: LaminarMode = defaultMode,
) {
  if (!projectApiKey) return;
  try {
    if (mode === "api") {
      const updated = await updateDatapointViaApi(
        evalId,
        datapointId,
        payload,
      );
      if (updated) {
        recordLaminarDatapoint("updated");
      }
      return;
    }
    const client = ensureClient();
    if (!client) return;
    await client.evals.updateDatapoint({
      evalId,
      datapointId,
      scores: payload.scores,
      executorOutput: payload.executorOutput,
    });
    recordLaminarDatapoint("updated");
  } catch (error) {
    recordLaminarError("update_datapoint");
    debugLog("Laminar datapoint update failed", error);
  }
}

export async function postEvaluatorScore(
  name: string,
  score: number,
  metadata?: Record<string, unknown>,
) {
  if (!projectApiKey) return;
  const traceId = safeGetTraceId();
  if (!traceId) return;

  try {
    const client = ensureClient();
    if (!client) return;
    await client.evaluators.score({
      name,
      score,
      traceId,
      metadata,
    });
  } catch (error) {
    recordLaminarError("evaluator_score");
    debugLog("Laminar evaluator score failed", error);
  }
}

export async function flushLaminar() {
  try {
    if (typeof Laminar.flush === "function") {
      await Laminar.flush();
    }
  } catch {
    // ignore flush errors
  }
}

export async function withEvalSpan<T>(
  name: string,
  input: unknown,
  metadata: Record<string, unknown> | undefined,
  runner: () => Promise<T>,
): Promise<{ traceId: string | null; result: T }> {
  if (!projectApiKey || !Laminar.initialized?.()) {
    const result = await runner();
    return { traceId: null, result };
  }

  let traceId: string | null = null;
  const tags = ["alfred", "evaluation"];
  const result = await observe(
    {
      name,
      spanType: "EVALUATION",
      traceType: "EVALUATION",
      input,
      metadata,
      tags,
    },
    async () => {
      const resolvedMetadata = {
        spanId: randomUUID(),
        ...(metadata ?? {}),
      };
      try {
        Laminar.setTraceMetadata(resolvedMetadata);
      } catch {
        // ignore metadata errors
      }
      traceId = safeGetTraceId();
      return runner();
    },
  );

  return { traceId: traceId ?? safeGetTraceId(), result };
}

function safeGetTraceId() {
  try {
    return Laminar.getTraceId?.() ?? null;
  } catch {
    return null;
  }
}

async function createEvaluationViaApi(
  name: string,
  groupName: string | undefined,
  metadata: Record<string, unknown> | undefined,
) {
  const baseHttpUrl = getBaseHttpUrl();
  if (!baseHttpUrl) return null;

  try {
    const response = await fetchJson(`${baseHttpUrl}/v1/evals`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        groupName,
        metadata,
      }),
    });
    const evalId = (response as { id?: string }).id;
    return evalId ?? null;
  } catch (error) {
    recordLaminarError("create_eval_api");
    debugLog("Laminar API create eval failed", error);
    return null;
  }
}

async function createDatapointViaApi(
  evalId: string,
  point: {
    data: unknown;
    target?: unknown;
    metadata?: Record<string, unknown>;
    index: number;
  },
  traceId?: string | null,
) {
  const baseHttpUrl = getBaseHttpUrl();
  if (!baseHttpUrl) return null;
  try {
    const response = await fetchJson(
      `${baseHttpUrl}/v1/evals/${evalId}/datapoints`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          data: point.data,
          target: point.target,
          metadata: point.metadata,
          index: point.index,
          traceId: traceId ?? undefined,
        }),
      },
    );
    const datapointId = (response as { id?: string }).id;
    return datapointId ?? null;
  } catch (error) {
    recordLaminarError("create_datapoint_api");
    debugLog("Laminar API create datapoint failed", error);
    return null;
  }
}

async function updateDatapointViaApi(
  evalId: string,
  datapointId: string,
  payload: {
    scores: Record<string, number>;
    executorOutput?: unknown;
  },
) {
  const baseHttpUrl = getBaseHttpUrl();
  if (!baseHttpUrl) return false;
  try {
    await fetchJson(
      `${baseHttpUrl}/v1/evals/${evalId}/datapoints/${datapointId}`,
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          scores: payload.scores,
          executorOutput: payload.executorOutput,
        }),
      },
    );
    return true;
  } catch (error) {
    recordLaminarError("update_datapoint_api");
    debugLog("Laminar API update datapoint failed", error);
    return false;
  }
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Laminar API ${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return {};
  return response.json() as Promise<unknown>;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${projectApiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function debugLog(message: string, error: unknown) {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.LOG_LEVEL === "debug") {
    // eslint-disable-next-line no-console
    console.debug(`[Laminar] ${message}`, error);
  }
}
