import type { RuntimeContext } from "@alfred/type/runtime-context";

import { logger } from "@alfred/logger";
import { redis as defaultRedis, RedisClient } from "bun";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import {
  runRegistryDispatchDurationSeconds,
  runRegistryEventsTotal,
} from "./metrics";

export interface ResumePayload {
  event:
    | "deploy-authz"
    | "linear-authz"
    | "bio-authz"
    | "mfa-authz"
    | "human-authz";
  authz: string;
}

export interface RunHandle {
  resume(args: {
    resumeData: unknown;
    runtimeContext?: RuntimeContext;
  }): Promise<unknown>;
  suspend?(): Promise<unknown>;
  cancel(): Promise<unknown>;
  abortController: AbortController;
}

export interface RunRegistry {
  register(runId: string, handle: RunHandle): Promise<void> | void;
  unregister(runId: string): Promise<void> | void;
  dispatchResume(runId: string, payload: unknown): Promise<boolean>;
  dispatchSuspend(runId: string): Promise<boolean>;
  dispatchCancel(runId: string): Promise<boolean>;
}

type RegistryEvent = "register" | "unregister" | "dispatch" | "deliver";
type RegistryOutcome = "ok" | "error" | "miss" | "local" | "delivered";
type DispatchOutcome = "local" | "delivered" | "miss" | "error";

type AckStatus = "ok" | "not_found" | "error";

const DEFAULT_ACK_TIMEOUT_MS = toPositiveInteger(
  process.env.RUN_REGISTRY_ACK_TIMEOUT_MS,
  2000
);
const DEFAULT_OWNER_TTL_SEC = toPositiveInteger(
  process.env.RUN_REGISTRY_OWNER_TTL_SEC,
  120
);
const DEFAULT_HEARTBEAT_MS = toPositiveInteger(
  process.env.RUN_REGISTRY_HEARTBEAT_MS,
  30_000
);
const ACK_TTL_SEC = 60;

const KEY_OWNER = (runId: string) => `rr:run:${runId}`;
const CH_INST = (instanceId: string) => `rr:inst:${instanceId}:resume`;
const KEY_ACK = (corrId: string) => `rr:ack:${corrId}`;

const BACKEND_MEMORY = "memory";
const BACKEND_REDIS = "redis";
const BACKEND_MEMORY_FALLBACK = "memory_fallback";

function toPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getInstanceId(): string {
  const explicit = process.env.INSTANCE_ID?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  return `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
}

function recordEvent(
  event: RegistryEvent,
  backend: string,
  outcome: RegistryOutcome
) {
  try {
    runRegistryEventsTotal.inc({ event, backend, outcome });
  } catch (error) {
    logger.warn("metrics_increment_failed", {
      event,
      backend,
      outcome,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function createDispatchTimer(backend: string) {
  try {
    const stop = runRegistryDispatchDurationSeconds.startTimer({ backend });
    return (outcome: DispatchOutcome) => {
      try {
        stop({ outcome });
      } catch (error) {
        logger.warn("metrics_timer_stop_failed", {
          backend,
          outcome,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
  } catch (error) {
    logger.warn("metrics_timer_create_failed", {
      backend,
      error: error instanceof Error ? error.message : String(error),
    });
    return (_outcome: DispatchOutcome) => {
      // noop
    };
  }
}

export class MemoryRunRegistry implements RunRegistry {
  private readonly runs = new Map<string, RunHandle>();
  private readonly backend = BACKEND_MEMORY;

  register(runId: string, handle: RunHandle) {
    this.runs.set(runId, handle);
    recordEvent("register", this.backend, "ok");
  }

  unregister(runId: string) {
    const existed = this.runs.delete(runId);
    recordEvent("unregister", this.backend, existed ? "ok" : "miss");
  }

  async dispatchResume(runId: string, payload: unknown): Promise<boolean> {
    const endTimer = createDispatchTimer(this.backend);
    const handle = this.runs.get(runId);
    if (!handle) {
      recordEvent("dispatch", this.backend, "miss");
      endTimer("miss");
      return false;
    }
    try {
      await handle.resume({ resumeData: payload });
      recordEvent("dispatch", this.backend, "local");
      endTimer("local");
      recordEvent("deliver", this.backend, "ok");
      return true;
    } catch (error) {
      recordEvent("dispatch", this.backend, "error");
      endTimer("error");
      recordEvent("deliver", this.backend, "error");
      throw error;
    }
  }

  async dispatchSuspend(runId: string): Promise<boolean> {
    const handle = this.runs.get(runId);
    if (handle?.suspend) {
      await handle.suspend();
      return true;
    }
    return false;
  }

  async dispatchCancel(runId: string): Promise<boolean> {
    const handle = this.runs.get(runId);
    if (!handle) {
      return false;
    }
    await handle.cancel();
    return true;
  }
}

export class RedisRunRegistry implements RunRegistry {
  private readonly runs = new Map<string, RunHandle>();
  private readonly backend = BACKEND_REDIS;
  private readonly instanceId: string;
  private readonly cmd: RedisClient;
  private readonly sub: RedisClient;
  private readonly ready: Promise<void>;
  private readonly ackTimeoutMs: number;
  private readonly ownerTtlSec: number;
  private readonly heartbeatMs: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(opts?: {
    url?: string;
    ackTimeoutMs?: number;
    ownerTtlSec?: number;
    heartbeatMs?: number;
  }) {
    this.instanceId = getInstanceId();
    this.ackTimeoutMs = opts?.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
    this.ownerTtlSec = opts?.ownerTtlSec ?? DEFAULT_OWNER_TTL_SEC;
    this.heartbeatMs = opts?.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    const url = opts?.url ?? process.env.REDIS_URL ?? undefined;
    this.cmd = url ? new RedisClient(url) : defaultRedis;
    this.sub = url ? new RedisClient(url) : new RedisClient();
    this.ready = this.initialize();
  }

  async register(runId: string, handle: RunHandle): Promise<void> {
    this.runs.set(runId, handle);
    try {
      await this.ensureReady();
      await (
        this.cmd.set as unknown as (
          key: string,
          value: string,
          options: { EX: number }
        ) => Promise<string>
      )(KEY_OWNER(runId), this.instanceId, {
        EX: this.ownerTtlSec,
      });
      this.ensureHeartbeat();
      recordEvent("register", this.backend, "ok");
    } catch (error) {
      this.runs.delete(runId);
      if (this.runs.size === 0) {
        this.stopHeartbeat();
      }
      recordEvent("register", this.backend, "error");
      throw error;
    }
  }

  async unregister(runId: string): Promise<void> {
    const existed = this.runs.delete(runId);
    if (this.runs.size === 0) {
      this.stopHeartbeat();
    }
    try {
      await this.ensureReady();
      await this.cmd.del(KEY_OWNER(runId));
      recordEvent("unregister", this.backend, existed ? "ok" : "miss");
    } catch (error) {
      recordEvent("unregister", this.backend, "error");
      throw error;
    }
  }

  async dispatchResume(runId: string, payload: unknown): Promise<boolean> {
    await this.ensureReady();
    const endTimer = createDispatchTimer(this.backend);
    const localHandle = this.runs.get(runId);
    if (localHandle) {
      try {
        await localHandle.resume({ resumeData: payload });
        recordEvent("dispatch", this.backend, "local");
        endTimer("local");
        return true;
      } catch (error) {
        recordEvent("dispatch", this.backend, "error");
        endTimer("error");
        throw error;
      }
    }

    const owner = await this.cmd.get(KEY_OWNER(runId));
    if (!owner) {
      recordEvent("dispatch", this.backend, "miss");
      endTimer("miss");
      return false;
    }
    if (owner === this.instanceId) {
      recordEvent("dispatch", this.backend, "miss");
      endTimer("miss");
      return false;
    }

    const corrId = randomUUID();
    const message = JSON.stringify({ type: "resume", runId, payload, corrId });
    try {
      await this.cmd.publish(CH_INST(owner), message);
    } catch (error) {
      recordEvent("dispatch", this.backend, "error");
      endTimer("error");
      throw error;
    }

    const ack = await this.awaitAck(corrId);
    if (!ack) {
      recordEvent("dispatch", this.backend, "error");
      endTimer("error");
      return false;
    }

    if (ack === "ok") {
      recordEvent("dispatch", this.backend, "delivered");
      endTimer("delivered");
      return true;
    }
    if (ack === "not_found") {
      recordEvent("dispatch", this.backend, "miss");
      endTimer("miss");
      return false;
    }

    recordEvent("dispatch", this.backend, "error");
    endTimer("error");
    return false;
  }

  async dispatchSuspend(runId: string): Promise<boolean> {
    await this.ensureReady();
    const localHandle = this.runs.get(runId);
    if (localHandle?.suspend) {
      await localHandle.suspend();
      return true;
    }

    const owner = await this.cmd.get(KEY_OWNER(runId));
    if (!owner || owner === this.instanceId) {
      return false;
    }

    const corrId = randomUUID();
    const message = JSON.stringify({ type: "suspend", runId, corrId });
    await this.cmd.publish(CH_INST(owner), message);

    const ack = await this.awaitAck(corrId);
    return ack === "ok";
  }

  async dispatchCancel(runId: string): Promise<boolean> {
    await this.ensureReady();
    const localHandle = this.runs.get(runId);
    if (localHandle) {
      await localHandle.cancel();
      return true;
    }

    const owner = await this.cmd.get(KEY_OWNER(runId));
    if (!owner || owner === this.instanceId) {
      return false;
    }

    const corrId = randomUUID();
    const message = JSON.stringify({ type: "cancel", runId, corrId });
    await this.cmd.publish(CH_INST(owner), message);

    const ack = await this.awaitAck(corrId);
    return ack === "ok";
  }

  private async initialize(): Promise<void> {
    try {
      await this.cmd.connect();
      if (!this.cmd.connected) {
        throw new Error("Command client not connected after connect()");
      }
    } catch (error) {
      logger.error("run_registry_cmd_connect_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    try {
      await this.sub.connect();
      if (!this.sub.connected) {
        throw new Error("Subscription client not connected after connect()");
      }
    } catch (error) {
      logger.error("run_registry_sub_connect_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    try {
      await this.sub.subscribe(CH_INST(this.instanceId), (raw, _channel) => {
        void this.handleMessage(raw);
      });
    } catch (error) {
      logger.error("run_registry_subscribe_failed", {
        error: error instanceof Error ? error.message : String(error),
        instanceId: this.instanceId,
      });
      throw error;
    }
  }

  private async ensureReady() {
    await this.ready;
    if (!this.cmd.connected) {
      throw new Error("Redis command client not connected");
    }
    if (!this.sub.connected) {
      throw new Error("Redis subscription client not connected");
    }
  }

  private ensureHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }
    const interval = Math.max(1000, this.heartbeatMs);
    this.heartbeatTimer = setInterval(() => {
      void this.pulseOwners();
    }, interval);
    if (typeof this.heartbeatTimer.unref === "function") {
      this.heartbeatTimer.unref();
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async pulseOwners() {
    if (this.runs.size === 0) {
      this.stopHeartbeat();
      return;
    }
    try {
      await this.ensureReady();
    } catch (error) {
      logger.warn("redis_heartbeat_ready_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const expirations = [...this.runs.keys()].map((runId) =>
      this.cmd.expire(KEY_OWNER(runId), this.ownerTtlSec).catch((error) => {
        logger.warn("redis_expire_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
    await Promise.all(expirations);
  }

  private async awaitAck(corrId: string): Promise<AckStatus | null> {
    const deadline = Date.now() + this.ackTimeoutMs;
    const key = KEY_ACK(corrId);
    while (Date.now() < deadline) {
      const status = await this.cmd.get(key);
      if (status) {
        await this.cmd.del(key);
        if (status === "ok" || status === "not_found" || status === "error") {
          return status;
        }
        return null;
      }
      await delay(50);
    }
    return null;
  }

  private async handleMessage(raw: string) {
    let parsed: {
      type?: "resume" | "suspend" | "cancel";
      runId?: string;
      payload?: unknown;
      corrId?: string;
    } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      logger.warn("redis_message_parse_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const runId = typeof parsed?.runId === "string" ? parsed.runId : null;
    const payload = parsed?.payload ?? null;
    const corrId = typeof parsed?.corrId === "string" ? parsed.corrId : null;
    const type = parsed?.type ?? "resume";

    if (!(runId && corrId)) {
      return;
    }

    const handle = this.runs.get(runId);
    if (!handle) {
      recordEvent("deliver", this.backend, "miss");
      await (
        this.cmd.set as unknown as (
          key: string,
          value: string,
          options: { EX: number }
        ) => Promise<string>
      )(KEY_ACK(corrId), "not_found", { EX: ACK_TTL_SEC });
      return;
    }

    let ackValue: AckStatus = "ok";
    try {
      if (type === "suspend") {
        if (handle.suspend) {
          await handle.suspend();
        } else {
          ackValue = "error";
        }
      } else if (type === "cancel") {
        await handle.cancel();
      } else {
        const resumePromise = handle.resume({ resumeData: payload });
        recordEvent("deliver", this.backend, "ok");
        resumePromise.catch((error) => {
          recordEvent("deliver", this.backend, "error");
          logger.warn("redis_resume_async_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      ackValue = "error";
      recordEvent("deliver", this.backend, "error");
      logger.warn(`redis_${type}_sync_failed`, {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await (
      this.cmd.set as unknown as (
        key: string,
        value: string,
        options: { EX: number }
      ) => Promise<string>
    )(KEY_ACK(corrId), ackValue, { EX: ACK_TTL_SEC });
  }
}

function shouldUseRedisBackend() {
  const backend = process.env.RUN_REGISTRY_BACKEND?.toLowerCase();
  return backend === BACKEND_REDIS;
}

export function createRunRegistry(): RunRegistry {
  if (!shouldUseRedisBackend()) {
    return new MemoryRunRegistry();
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn("run_registry_redis_missing", {
      backend: "redis",
      fallback: "memory",
    });
    recordEvent("register", BACKEND_MEMORY_FALLBACK, "error");
    return new MemoryRunRegistry();
  }

  try {
    return new RedisRunRegistry({
      url,
      ackTimeoutMs: DEFAULT_ACK_TIMEOUT_MS,
      ownerTtlSec: DEFAULT_OWNER_TTL_SEC,
      heartbeatMs: DEFAULT_HEARTBEAT_MS,
    });
  } catch (error) {
    logger.error("run_registry_redis_init_failed", {
      error: error instanceof Error ? error.message : String(error),
      fallback: "memory",
    });
    recordEvent("register", BACKEND_MEMORY_FALLBACK, "error");
    return new MemoryRunRegistry();
  }
}

export const runRegistry: RunRegistry = createRunRegistry();
