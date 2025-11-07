import os from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import type { RuntimeContext } from "@mastra/core/runtime-context";
import { redis as defaultRedis, RedisClient } from "bun";

import { runRegistryDispatchDurationSeconds, runRegistryEventsTotal } from "./metrics";

export type ResumePayload = {
  event: "deploy-authz" | "linear-authz" | "bio-authz";
  authz: string;
};

export interface RunHandle {
  resume(args: { resumeData: ResumePayload; runtimeContext?: RuntimeContext }): Promise<unknown>;
  cancel(): Promise<unknown>;
  abortController: AbortController;
}

export interface RunRegistry {
  register(runId: string, handle: RunHandle): Promise<void> | void;
  unregister(runId: string): Promise<void> | void;
  dispatchResume(runId: string, payload: ResumePayload): Promise<boolean>;
}

type RegistryEvent = "register" | "unregister" | "dispatch" | "deliver";
type RegistryOutcome = "ok" | "error" | "miss" | "local" | "delivered";
type DispatchOutcome = "local" | "delivered" | "miss" | "error";

type AckStatus = "ok" | "not_found" | "error";

const DEFAULT_ACK_TIMEOUT_MS = toPositiveInteger(process.env.RUN_REGISTRY_ACK_TIMEOUT_MS, 2_000);
const DEFAULT_OWNER_TTL_SEC = toPositiveInteger(process.env.RUN_REGISTRY_OWNER_TTL_SEC, 120);
const DEFAULT_HEARTBEAT_MS = toPositiveInteger(process.env.RUN_REGISTRY_HEARTBEAT_MS, 30_000);
const ACK_TTL_SEC = 60;

const KEY_OWNER = (runId: string) => `rr:run:${runId}`;
const CH_INST = (instanceId: string) => `rr:inst:${instanceId}:resume`;
const KEY_ACK = (corrId: string) => `rr:ack:${corrId}`;

const BACKEND_MEMORY = "memory";
const BACKEND_REDIS = "redis";
const BACKEND_MEMORY_FALLBACK = "memory_fallback";

function toPositiveInteger(value: string | undefined, fallback: number): number {
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

function recordEvent(event: RegistryEvent, backend: string, outcome: RegistryOutcome) {
  try {
    runRegistryEventsTotal.inc({ event, backend, outcome });
  } catch {
    // ignore metrics errors to keep registry critical path fast
  }
}

function createDispatchTimer(backend: string) {
  try {
    const stop = runRegistryDispatchDurationSeconds.startTimer({ backend });
    return (outcome: DispatchOutcome) => {
      try {
        stop({ outcome });
      } catch {
        // ignore histogram errors
      }
    };
  } catch {
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

  async dispatchResume(runId: string, payload: ResumePayload): Promise<boolean> {
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
      await this.cmd.set(KEY_OWNER(runId), this.instanceId, { EX: this.ownerTtlSec });
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

  async dispatchResume(runId: string, payload: ResumePayload): Promise<boolean> {
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
    const message = JSON.stringify({ runId, payload, corrId });
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

  private async initialize(): Promise<void> {
    await this.cmd.connect();
    await this.sub.connect();
    await this.sub.subscribe(CH_INST(this.instanceId), (raw, _channel) => {
      void this.handleMessage(raw);
    });
  }

  private async ensureReady() {
    await this.ready;
  }

  private ensureHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }
    const interval = Math.max(1_000, this.heartbeatMs);
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
    } catch {
      return;
    }
    const expirations = Array.from(this.runs.keys()).map(runId =>
      this.cmd
        .expire(KEY_OWNER(runId), this.ownerTtlSec)
        .catch(() => {
          // ignore expiration failures; heartbeat will retry on next tick
        }),
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
    let parsed: { runId?: string; payload?: ResumePayload; corrId?: string } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const runId = typeof parsed?.runId === "string" ? parsed.runId : null;
    const payload = parsed?.payload ?? null;
    const corrId = typeof parsed?.corrId === "string" ? parsed.corrId : null;
    if (!runId || !payload || !corrId) {
      return;
    }

    const handle = this.runs.get(runId);
    if (!handle) {
      recordEvent("deliver", this.backend, "miss");
      await this.cmd.set(KEY_ACK(corrId), "not_found", { EX: ACK_TTL_SEC });
      return;
    }

    let ackValue: AckStatus = "ok";
    try {
      const resumePromise = handle.resume({ resumeData: payload });
      recordEvent("deliver", this.backend, "ok");
      resumePromise.catch(() => {
        recordEvent("deliver", this.backend, "error");
      });
    } catch {
      ackValue = "error";
      recordEvent("deliver", this.backend, "error");
    }

    await this.cmd.set(KEY_ACK(corrId), ackValue, { EX: ACK_TTL_SEC });
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
    console.warn("[run-registry] RUN_REGISTRY_BACKEND=redis but REDIS_URL missing; falling back to memory.");
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
    console.error("[run-registry] Failed to initialize Redis registry, falling back to memory.", error);
    recordEvent("register", BACKEND_MEMORY_FALLBACK, "error");
    return new MemoryRunRegistry();
  }
}

export const runRegistry: RunRegistry = createRunRegistry();
