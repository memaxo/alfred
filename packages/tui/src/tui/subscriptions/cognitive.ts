/**
 * ALFRED TUI Cognitive State Subscription
 *
 * Polls or subscribes to cognitive state updates.
 */

import { getApiClient } from "../api/client";
import type { SubscriptionManager } from "./manager";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CognitivePhase =
  | "idle"
  | "capturing"
  | "thinking"
  | "deciding"
  | "executing"
  | "reflecting";

export type PhysiologyState = {
  energy: number;
  boredom: number;
  frustration: number;
};

export type AutonomyState = {
  level: number;
  confidence: number;
  threshold: number;
};

export type CognitiveState = {
  phase: CognitivePhase;
  physiology: PhysiologyState;
  autonomy: AutonomyState;
  timestamp: number;
};

export type CognitiveTransition = {
  from: CognitivePhase;
  to: CognitivePhase;
  timestamp: number;
  reason?: string;
};

export type CognitiveHistory = {
  transitions: CognitiveTransition[];
  maxLength: number;
};

// ─── Mock Data (until API endpoints exist) ───────────────────────────────────

function mockCognitiveState(): CognitiveState {
  const phases: CognitivePhase[] = [
    "idle",
    "capturing",
    "thinking",
    "deciding",
    "executing",
    "reflecting",
  ];
  const randomPhase =
    phases[Math.floor(Math.random() * phases.length)] ?? "idle";

  return {
    phase: randomPhase,
    physiology: {
      energy: 0.7 + Math.random() * 0.3,
      boredom: Math.random() * 0.3,
      frustration: Math.random() * 0.2,
    },
    autonomy: {
      level: 0.5 + Math.random() * 0.4,
      confidence: 0.6 + Math.random() * 0.3,
      threshold: 0.5,
    },
    timestamp: Date.now(),
  };
}

// ─── Cognitive State Store ───────────────────────────────────────────────────

export class CognitiveStateStore {
  private state: CognitiveState | null = null;
  private readonly history: CognitiveHistory = {
    transitions: [],
    maxLength: 20,
  };
  private readonly listeners: Set<(state: CognitiveState) => void> = new Set();

  getState(): CognitiveState | null {
    return this.state;
  }

  getHistory(): CognitiveTransition[] {
    return [...this.history.transitions];
  }

  update(newState: CognitiveState): void {
    // Record transition if phase changed
    if (this.state && this.state.phase !== newState.phase) {
      this.history.transitions.push({
        from: this.state.phase,
        to: newState.phase,
        timestamp: newState.timestamp,
      });

      // Trim history
      if (this.history.transitions.length > this.history.maxLength) {
        this.history.transitions = this.history.transitions.slice(
          -this.history.maxLength
        );
      }
    }

    this.state = newState;
    this.notify();
  }

  subscribe(listener: (state: CognitiveState) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
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

// ─── Cognitive Subscription Setup ────────────────────────────────────────────

export type CognitiveSubscriptionOptions = {
  manager: SubscriptionManager;
  store: CognitiveStateStore;
  pollingInterval?: number;
  useMockData?: boolean;
};

export function setupCognitiveSubscription(
  options: CognitiveSubscriptionOptions
): void {
  const {
    manager,
    store,
    pollingInterval = 2000,
    useMockData = true,
  } = options;

  if (useMockData) {
    // Use polling with mock data
    manager.addPolling({
      id: "cognitive",
      fetch: () => Promise.resolve(mockCognitiveState()),
      onData: (state) => store.update(state),
      onError: (_error) => {},
      interval: pollingInterval,
      immediate: true,
    });
  } else {
    manager.addPolling({
      id: "cognitive",
      fetch: async () => {
        const client = getApiClient();
        const result = await client.getCognitiveState("default");
        if (result.error || !result.data) {
          return mockCognitiveState();
        }

        const phaseRaw = result.data.phase;
        const phase: CognitivePhase =
          phaseRaw === "idle" ||
          phaseRaw === "capturing" ||
          phaseRaw === "thinking" ||
          phaseRaw === "deciding" ||
          phaseRaw === "executing" ||
          phaseRaw === "reflecting"
            ? phaseRaw
            : "idle";

        const stateObj = result.data.state as unknown as {
          physiology?: Partial<PhysiologyState>;
        };
        const physiology = stateObj.physiology;

        return {
          phase,
          physiology: {
            energy: physiology?.energy ?? 0.5,
            boredom: physiology?.boredom ?? 0,
            frustration: physiology?.frustration ?? 0,
          },
          autonomy: {
            level: result.data.autonomy.level ?? 0.5,
            confidence: result.data.autonomy.level ?? 0.5,
            threshold: 0.5,
          },
          timestamp: result.data.ts ?? Date.now(),
        };
      },
      onData: (state) => store.update(state),
      onError: (_error) => {},
      interval: pollingInterval,
      immediate: true,
    });
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createCognitiveStore(): CognitiveStateStore {
  return new CognitiveStateStore();
}

// ─── Mock State Factory ───────────────────────────────────────────────────────

export type MockCognitiveState = {
  phase: CognitivePhase;
  autonomy: number;
  physiology: PhysiologyState;
  timestamp: number;
};

export function createMockCognitiveState(): MockCognitiveState {
  return {
    phase: "thinking",
    autonomy: 0.72,
    physiology: {
      energy: 0.91,
      boredom: 0.05,
      frustration: 0.12,
    },
    timestamp: Date.now(),
  };
}
