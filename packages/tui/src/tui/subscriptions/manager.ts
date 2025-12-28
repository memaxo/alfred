/**
 * ALFRED TUI Subscription Manager
 *
 * Manages tRPC subscriptions and polling for real-time data updates.
 */

import { EventEmitter } from "node:events";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Unsubscriber = () => void;

export type SubscriptionConfig<T> = {
  id: string;
  start: () => Promise<{
    unsubscribe: Unsubscriber;
    onData: (callback: (data: T) => void) => void;
    onError: (callback: (error: Error) => void) => void;
  }>;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  retryDelay?: number;
  maxRetries?: number;
};

export type PollingConfig<T> = {
  id: string;
  fetch: () => Promise<T>;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  interval: number;
  immediate?: boolean;
};

export type SubscriptionState = {
  id: string;
  type: "subscription" | "polling";
  status: "idle" | "connecting" | "connected" | "error" | "closed";
  error?: Error;
  retries: number;
  lastUpdate?: Date;
};

// ─── Subscription Manager ────────────────────────────────────────────────────

export class SubscriptionManager extends EventEmitter {
  private readonly subscriptions = new Map<
    string,
    {
      config: SubscriptionConfig<unknown> | PollingConfig<unknown>;
      state: SubscriptionState;
      unsubscribe?: Unsubscriber;
      intervalId?: ReturnType<typeof setInterval>;
    }
  >();

  // ─── Subscription Management ─────────────────────────────────────────────

  /**
   * Add a real-time subscription
   */
  async addSubscription<T>(config: SubscriptionConfig<T>): Promise<void> {
    if (this.subscriptions.has(config.id)) {
      await this.removeSubscription(config.id);
    }

    const state: SubscriptionState = {
      id: config.id,
      type: "subscription",
      status: "connecting",
      retries: 0,
    };

    this.subscriptions.set(config.id, {
      config: config as SubscriptionConfig<unknown>,
      state,
    });

    this.emit("stateChange", state);

    try {
      const { unsubscribe, onData, onError } = await config.start();

      const entry = this.subscriptions.get(config.id);
      if (entry) {
        entry.unsubscribe = unsubscribe;
        entry.state.status = "connected";
        this.emit("stateChange", entry.state);
      }

      onData((data) => {
        const entry = this.subscriptions.get(config.id);
        if (entry) {
          entry.state.lastUpdate = new Date();
          entry.state.retries = 0;
          config.onData(data as T);
          this.emit("data", config.id, data);
        }
      });

      onError((error) => {
        const entry = this.subscriptions.get(config.id);
        if (entry) {
          entry.state.status = "error";
          entry.state.error = error;
          config.onError?.(error);
          this.emit("error", config.id, error);

          // Auto-retry
          if (entry.state.retries < (config.maxRetries ?? 3)) {
            entry.state.retries++;
            setTimeout(() => {
              void this.reconnectSubscription(config.id);
            }, config.retryDelay ?? 1000);
          }
        }
      });
    } catch (error) {
      const entry = this.subscriptions.get(config.id);
      if (entry) {
        entry.state.status = "error";
        entry.state.error = error as Error;
        config.onError?.(error as Error);
        this.emit("error", config.id, error);
      }
    }
  }

  /**
   * Add a polling subscription
   */
  addPolling<T>(config: PollingConfig<T>): void {
    if (this.subscriptions.has(config.id)) {
      this.removePolling(config.id);
    }

    const state: SubscriptionState = {
      id: config.id,
      type: "polling",
      status: "connected",
      retries: 0,
    };

    const poll = async () => {
      try {
        const data = await config.fetch();
        const entry = this.subscriptions.get(config.id);
        if (entry) {
          entry.state.lastUpdate = new Date();
          entry.state.status = "connected";
          entry.state.error = undefined;
          config.onData(data);
          this.emit("data", config.id, data);
        }
      } catch (error) {
        const entry = this.subscriptions.get(config.id);
        if (entry) {
          entry.state.error = error as Error;
          config.onError?.(error as Error);
          this.emit("error", config.id, error);
        }
      }
    };

    // Start polling
    const intervalId = setInterval(poll, config.interval);

    this.subscriptions.set(config.id, {
      config: config as PollingConfig<unknown>,
      state,
      intervalId,
    });

    this.emit("stateChange", state);

    // Immediate first poll
    if (config.immediate !== false) {
      void poll();
    }
  }

  /**
   * Remove a subscription
   */
  removeSubscription(id: string): Promise<void> {
    const entry = this.subscriptions.get(id);
    if (!entry) {
      return Promise.resolve();
    }

    if (entry.unsubscribe) {
      try {
        entry.unsubscribe();
      } catch {
        // Ignore cleanup errors
      }
    }

    entry.state.status = "closed";
    this.emit("stateChange", entry.state);
    this.subscriptions.delete(id);
    return Promise.resolve();
  }

  /**
   * Remove a polling subscription
   */
  removePolling(id: string): void {
    const entry = this.subscriptions.get(id);
    if (!entry) {
      return;
    }

    if (entry.intervalId) {
      clearInterval(entry.intervalId);
    }

    entry.state.status = "closed";
    this.emit("stateChange", entry.state);
    this.subscriptions.delete(id);
  }

  /**
   * Reconnect a subscription
   */
  private async reconnectSubscription(id: string): Promise<void> {
    const entry = this.subscriptions.get(id);
    if (!entry || entry.state.type !== "subscription") {
      return;
    }

    if (entry.unsubscribe) {
      try {
        entry.unsubscribe();
      } catch {
        // Ignore
      }
    }

    entry.state.status = "connecting";
    this.emit("stateChange", entry.state);

    const config = entry.config as SubscriptionConfig<unknown>;
    try {
      const { unsubscribe, onData, onError } = await config.start();
      entry.unsubscribe = unsubscribe;
      entry.state.status = "connected";
      this.emit("stateChange", entry.state);

      onData((data) => {
        entry.state.lastUpdate = new Date();
        entry.state.retries = 0;
        config.onData(data);
        this.emit("data", id, data);
      });

      onError((error) => {
        entry.state.status = "error";
        entry.state.error = error;
        config.onError?.(error);
        this.emit("error", id, error);
      });
    } catch (error) {
      entry.state.status = "error";
      entry.state.error = error as Error;
      config.onError?.(error as Error);
      this.emit("error", id, error);
    }
  }

  // ─── State Access ────────────────────────────────────────────────────────

  getState(id: string): SubscriptionState | undefined {
    return this.subscriptions.get(id)?.state;
  }

  getAllStates(): SubscriptionState[] {
    return Array.from(this.subscriptions.values()).map((e) => e.state);
  }

  isConnected(id: string): boolean {
    return this.subscriptions.get(id)?.state.status === "connected";
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Close all subscriptions
   */
  async closeAll(): Promise<void> {
    const ids = Array.from(this.subscriptions.keys());
    for (const id of ids) {
      const entry = this.subscriptions.get(id);
      if (entry?.state.type === "subscription") {
        await this.removeSubscription(id);
      } else {
        this.removePolling(id);
      }
    }
  }

  /**
   * Pause all polling (subscriptions remain active)
   */
  pausePolling(): void {
    for (const entry of this.subscriptions.values()) {
      if (entry.intervalId) {
        clearInterval(entry.intervalId);
        entry.intervalId = undefined;
      }
    }
  }

  /**
   * Resume all polling
   */
  resumePolling(): void {
    for (const [, entry] of this.subscriptions) {
      if (entry.state.type === "polling" && !entry.intervalId) {
        const config = entry.config as PollingConfig<unknown>;
        const poll = async () => {
          try {
            const data = await config.fetch();
            entry.state.lastUpdate = new Date();
            entry.state.status = "connected";
            entry.state.error = undefined;
            config.onData(data);
            this.emit("data", entry.config.id, data);
          } catch (error) {
            entry.state.error = error as Error;
            config.onError?.(error as Error);
            this.emit("error", entry.config.id, error);
          }
        };
        entry.intervalId = setInterval(poll, config.interval);
      }
    }
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

let globalManager: SubscriptionManager | null = null;

export function getSubscriptionManager(): SubscriptionManager {
  if (!globalManager) {
    globalManager = new SubscriptionManager();
  }
  return globalManager;
}

export function resetSubscriptionManager(): void {
  if (globalManager) {
    void globalManager.closeAll();
    globalManager = null;
  }
}
