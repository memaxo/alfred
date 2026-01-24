/**
 * ALFRED TUI Voice Subscription
 *
 * Subscribes to voice pipeline status updates.
 */

import type { SubscriptionManager } from "./manager";

import { getApiClient } from "../api/client";
import { addPollingWithFallback, type DataMode } from "./mode";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoicePipelineStatus =
  | "offline"
  | "initializing"
  | "standby"
  | "listening"
  | "processing"
  | "speaking";

export type VoicePoolStats = {
  name: string;
  workers: number;
  maxWorkers: number;
  queueDepth: number;
  processing: number;
};

export type VoiceLatencyStats = {
  sttP50: number;
  sttP99: number;
  ttsP50: number;
  ttsP99: number;
};

export type VoiceState = {
  status: VoicePipelineStatus;
  sttPool: VoicePoolStats;
  ttsPool: VoicePoolStats;
  latency: VoiceLatencyStats;
  activeSessions: number;
  timestamp: number;
};

export type VoiceEvent = {
  type: "status" | "session" | "metrics";
  state: Partial<VoiceState>;
  timestamp: number;
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

function mockVoiceState(): VoiceState {
  const statuses: VoicePipelineStatus[] = [
    "standby",
    "listening",
    "processing",
    "speaking",
  ];
  const status =
    statuses[Math.floor(Math.random() * statuses.length)] ?? "standby";

  return {
    status,
    sttPool: {
      name: "whisper",
      workers: 2,
      maxWorkers: 4,
      queueDepth: Math.floor(Math.random() * 3),
      processing: Math.floor(Math.random() * 2),
    },
    ttsPool: {
      name: "piper",
      workers: 2,
      maxWorkers: 4,
      queueDepth: Math.floor(Math.random() * 3),
      processing: Math.floor(Math.random() * 2),
    },
    latency: {
      sttP50: 150 + Math.random() * 100,
      sttP99: 400 + Math.random() * 200,
      ttsP50: 80 + Math.random() * 50,
      ttsP99: 200 + Math.random() * 100,
    },
    activeSessions: Math.floor(Math.random() * 2),
    timestamp: Date.now(),
  };
}

// ─── Voice Store ─────────────────────────────────────────────────────────────

export class VoiceStore {
  private state: VoiceState | null = null;
  private readonly listeners: Set<(state: VoiceState) => void> = new Set();

  getState(): VoiceState | null {
    return this.state;
  }

  getStatus(): VoicePipelineStatus {
    return this.state?.status ?? "offline";
  }

  update(newState: VoiceState): void {
    this.state = newState;
    this.notify();
  }

  handleEvent(event: VoiceEvent): void {
    if (!this.state) {
      // Initialize with defaults
      this.state = {
        status: "offline",
        sttPool: {
          name: "whisper",
          workers: 0,
          maxWorkers: 4,
          queueDepth: 0,
          processing: 0,
        },
        ttsPool: {
          name: "piper",
          workers: 0,
          maxWorkers: 4,
          queueDepth: 0,
          processing: 0,
        },
        latency: { sttP50: 0, sttP99: 0, ttsP50: 0, ttsP99: 0 },
        activeSessions: 0,
        timestamp: Date.now(),
      };
    }

    // Merge partial update
    this.state = {
      ...this.state,
      ...event.state,
      timestamp: event.timestamp,
    };

    this.notify();
  }

  subscribe(listener: (state: VoiceState) => void): () => void {
    this.listeners.add(listener);
    if (this.state) {
      listener(this.state);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (!this.state) {
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// ─── Voice Subscription Setup ────────────────────────────────────────────────

export type VoiceSubscriptionOptions = {
  manager: SubscriptionManager;
  store: VoiceStore;
  pollingInterval?: number;
  mode?: DataMode;
};

export function setupVoiceSubscription(
  options: VoiceSubscriptionOptions
): void {
  const { manager, store, pollingInterval = 3000, mode } = options;

  addPollingWithFallback({
    manager,
    id: "voice",
    mode,
    interval: pollingInterval,
    immediate: true,
    maxFailures: 3,
    fetchMock: async () => mockVoiceState(),
    fetchLive: async () => {
      const client = getApiClient();
      const result = await client.getAdminStats();
      if (result.error || !result.data) {
        const code = result.error?.code;
        const msg = result.error?.message ?? "";
        const isAuth = code === "HTTP_ERROR" && /HTTP (401|403)\b/.test(msg);
        if (code === "NETWORK_ERROR" || isAuth) {
          throw new Error("tui_live_unavailable");
        }
        throw new Error("tui_voice_fetch_failed");
      }

      const activeSessions = result.data.voice.activeSessions;
      const status: VoicePipelineStatus =
        activeSessions > 0 ? "processing" : "standby";
      return {
        status,
        sttPool: {
          name: "stt",
          workers: 0,
          maxWorkers: 0,
          queueDepth: 0,
          processing: 0,
        },
        ttsPool: {
          name: "tts",
          workers: 0,
          maxWorkers: 0,
          queueDepth: 0,
          processing: 0,
        },
        latency: { sttP50: 0, sttP99: 0, ttsP50: 0, ttsP99: 0 },
        activeSessions,
        timestamp: Date.now(),
      };
    },
    onData: (state) => store.update(state),
    onError: (_error) => {},
  });
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createVoiceStore(): VoiceStore {
  return new VoiceStore();
}
