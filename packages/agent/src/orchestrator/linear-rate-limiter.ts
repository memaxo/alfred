import { setTimeout as sleep } from "node:timers/promises";
import { logger } from "@alfred/logger";
import type { LinearActivityType } from "./linear";

const WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 55; // Keep headroom under Linear's 60/min cap
const DEFAULT_ACTION_COOLDOWN_MS = 30_000;
const DEFAULT_STARTUP_BUFFER_MS = 9000;

export type LinearRateLimitCategory = LinearActivityType | "session";

type RateLimiterOptions = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  maxRequestsPerMinute?: number;
  actionCooldownMs?: number;
  startupBufferMs?: number;
};

type ThrottleOptions = {
  requireStartupBuffer?: boolean;
};

export class LinearRateLimiter {
  private readonly nowFn: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly maxRequestsPerMinute: number;
  private readonly actionCooldownMs: number;
  private readonly startupBufferMs: number;
  private readonly initializedAt: number;
  private windowStart: number;
  private requestCount = 0;
  private lastActionAt = Number.NEGATIVE_INFINITY;
  private startupSatisfied = false;
  private lock: Promise<void> = Promise.resolve();

  constructor(options: RateLimiterOptions = {}) {
    this.nowFn = options.now ?? (() => Date.now());
    this.sleepFn = options.sleep ?? ((ms) => sleep(ms));
    this.maxRequestsPerMinute =
      options.maxRequestsPerMinute ?? DEFAULT_MAX_REQUESTS_PER_MINUTE;
    this.actionCooldownMs =
      options.actionCooldownMs ?? DEFAULT_ACTION_COOLDOWN_MS;
    this.startupBufferMs = options.startupBufferMs ?? DEFAULT_STARTUP_BUFFER_MS;
    this.initializedAt = this.nowFn();
    this.windowStart = this.initializedAt;
  }

  async throttle(
    category: LinearRateLimitCategory,
    options: ThrottleOptions = {}
  ): Promise<void> {
    const requireStartupBuffer =
      options.requireStartupBuffer ??
      (category === "action" || category === "thought");

    this.lock = this.lock.then(() =>
      this.applyThrottle(category, { requireStartupBuffer })
    );
    return this.lock;
  }

  async handle429(retryAfterMs?: number): Promise<void> {
    const waitMs = Math.max(retryAfterMs ?? WINDOW_MS, 1000);
    logger?.warn?.("linear_activity_rate_limited", {
      waitMs,
      retryAfterMs,
    });

    this.windowStart = this.nowFn();
    this.requestCount = this.maxRequestsPerMinute;
    await this.sleepFn(waitMs);
    this.windowStart = this.nowFn();
    this.requestCount = 0;
  }

  private async applyThrottle(
    category: LinearRateLimitCategory,
    options: { requireStartupBuffer: boolean }
  ): Promise<void> {
    const now = this.nowFn();
    if (options.requireStartupBuffer) {
      await this.enforceStartupBuffer(now);
    }

    const afterStartup = this.nowFn();
    await this.enforceGlobalWindow(afterStartup);

    if (category === "action") {
      const nowForAction = this.nowFn();
      await this.enforceActionCooldown(nowForAction);
      this.lastActionAt = this.nowFn();
    }

    this.requestCount += 1;
  }

  private async enforceStartupBuffer(now: number): Promise<void> {
    if (this.startupSatisfied || this.startupBufferMs <= 0) {
      return;
    }
    const elapsed = now - this.initializedAt;
    if (elapsed >= this.startupBufferMs) {
      this.startupSatisfied = true;
      this.windowStart = now;
      this.requestCount = 0;
      return;
    }
    // Within startup window, skip global throttling but still respect per-activity spacing
  }

  private async enforceGlobalWindow(now: number): Promise<void> {
    if (!this.startupSatisfied && this.startupBufferMs > 0) {
      return;
    }

    if (now - this.windowStart >= WINDOW_MS) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    if (this.requestCount < this.maxRequestsPerMinute) {
      return;
    }

    const waitMs = Math.max(WINDOW_MS - (now - this.windowStart), 0);
    if (waitMs > 0) {
      await this.sleepFn(waitMs);
    }
    this.windowStart = this.nowFn();
    this.requestCount = 0;
  }

  private async enforceActionCooldown(now: number): Promise<void> {
    if (!Number.isFinite(this.lastActionAt)) {
      return;
    }
    const elapsed = now - this.lastActionAt;
    if (elapsed >= this.actionCooldownMs) {
      return;
    }
    const waitMs = this.actionCooldownMs - elapsed;
    await this.sleepFn(waitMs);
  }
}

export const linearRateLimiter = new LinearRateLimiter();
