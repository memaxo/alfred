import { mock } from "bun:test";

export interface TicketCall {
  input: {
    space: string;
    action: string;
    issueId?: string;
    sessionId?: string;
    description?: string;
    authz: string;
    [key: string]: unknown;
  };
}

type Mode = "ok" | "fail";

const state = {
  calls: [] as TicketCall[],
  throttleCount: 0,
  mode: "ok" as Mode,
};

export function setLinearRateLimiterMode(mode: Mode): void {
  state.mode = mode;
}

export function resetLinearMocks(): void {
  state.calls.length = 0;
  state.throttleCount = 0;
  state.mode = "ok";
}

export function getLinearCalls(): readonly TicketCall[] {
  return state.calls;
}

export function getLinearThrottleCount(): number {
  return state.throttleCount;
}

mock.module("@alfred/agent/orchestrator/linear-rate-limiter", () => ({
  LinearRateLimiter: class LinearRateLimiter {
    constructor() {
      if (state.mode === "fail") {
        throw new Error("init fail");
      }
    }

    throttle(): Promise<void> {
      state.throttleCount += 1;
      return Promise.resolve();
    }
  },
}));

mock.module("@alfred/agent/orchestrator/tool/ticket", () => ({
  toolTicket: {
    execute: (args: TicketCall) => {
      state.calls.push(args);
      return Promise.resolve();
    },
  },
}));
