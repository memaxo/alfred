import { describe, expect, it } from "bun:test";
import { initialAutonomy } from "../src/autonomy/update";
import type { Plan } from "../src/plan/types";
import {
  capturing,
  deciding,
  executing,
  idle,
  reflecting,
  thinking,
} from "../src/state/factory";
import {
  canInterrupt,
  duration,
  isActive,
  isExecuting,
  isStale,
  requiresInput,
} from "../src/state/predicate";
import { confidence } from "../src/util/math";

const now = 1_700_000_000_000;
const auto = initialAutonomy(now);
const plan: Plan = {
  steps: [{ action: "test", params: {}, timeout: 1000, retryable: true }],
  duration: 1000,
  confidence: confidence(0.8),
};

describe("isActive", () => {
  it("returns false for idle state", () => {
    expect(isActive(idle(now))).toBe(false);
  });

  it("returns true for capturing state", () => {
    expect(isActive(capturing(now, "input", 0.8))).toBe(true);
  });

  it("returns true for thinking state", () => {
    expect(isActive(thinking(now, "topic"))).toBe(true);
  });

  it("returns true for deciding state", () => {
    expect(isActive(deciding(now, []))).toBe(true);
  });

  it("returns true for executing state", () => {
    expect(isActive(executing(now, plan, auto))).toBe(true);
  });

  it("returns true for reflecting state", () => {
    expect(
      isActive(
        reflecting({ _: "success", result: null, duration: 10 }, "a", "b")
      )
    ).toBe(true);
  });
});

describe("canInterrupt", () => {
  it("returns false for idle state", () => {
    expect(canInterrupt(idle(now))).toBe(false);
  });

  it("returns false for capturing state", () => {
    expect(canInterrupt(capturing(now, "input", 0.8))).toBe(false);
  });

  it("returns true for thinking state", () => {
    expect(canInterrupt(thinking(now, "topic"))).toBe(true);
  });

  it("returns true for deciding state", () => {
    expect(canInterrupt(deciding(now, []))).toBe(true);
  });

  it("returns false for executing state", () => {
    expect(canInterrupt(executing(now, plan, auto))).toBe(false);
  });

  it("returns false for reflecting state", () => {
    expect(
      canInterrupt(
        reflecting({ _: "success", result: null, duration: 10 }, "a", "b")
      )
    ).toBe(false);
  });
});

describe("requiresInput", () => {
  it("returns true for idle state", () => {
    expect(requiresInput(idle(now))).toBe(true);
  });

  it("returns false for capturing state", () => {
    expect(requiresInput(capturing(now, "input", 0.8))).toBe(false);
  });

  it("returns false for thinking state", () => {
    expect(requiresInput(thinking(now, "topic"))).toBe(false);
  });

  it("returns false for deciding state", () => {
    expect(requiresInput(deciding(now, []))).toBe(false);
  });

  it("returns false for executing state", () => {
    expect(requiresInput(executing(now, plan, auto))).toBe(false);
  });

  it("returns true for reflecting state", () => {
    expect(
      requiresInput(
        reflecting({ _: "success", result: null, duration: 10 }, "a", "b")
      )
    ).toBe(true);
  });
});

describe("isExecuting", () => {
  it("returns false for idle state", () => {
    expect(isExecuting(idle(now))).toBe(false);
  });

  it("returns false for thinking state", () => {
    expect(isExecuting(thinking(now, "topic"))).toBe(false);
  });

  it("returns true for executing state", () => {
    expect(isExecuting(executing(now, plan, auto))).toBe(true);
  });
});

describe("duration", () => {
  it("calculates time since idle started", () => {
    const state = idle(now);
    expect(duration(state, now + 5000)).toBe(5000);
  });

  it("calculates time since capturing started", () => {
    const state = capturing(now, "input", 0.8);
    expect(duration(state, now + 3000)).toBe(3000);
  });

  it("calculates time since thinking started", () => {
    const state = thinking(now, "topic");
    expect(duration(state, now + 2000)).toBe(2000);
  });

  it("calculates time remaining until deciding deadline", () => {
    const state = deciding(now, []);
    // deadline is now + 5000 by default
    expect(duration(state, now + 1000)).toBe(4000);
  });

  it("calculates time since executing started", () => {
    const state = executing(now, plan, auto);
    expect(duration(state, now + 1500)).toBe(1500);
  });

  it("returns 0 for reflecting state", () => {
    const state = reflecting(
      { _: "success", result: null, duration: 10 },
      "a",
      "b"
    );
    expect(duration(state, now + 5000)).toBe(0);
  });

  it("uses Date.now() when now parameter is omitted", () => {
    const state = idle(Date.now() - 1000);
    const d = duration(state);
    expect(d).toBeGreaterThanOrEqual(1000);
    expect(d).toBeLessThan(2000);
  });
});

describe("isStale", () => {
  it("returns false when duration is below threshold", () => {
    const state = idle(now);
    expect(isStale(state, 30_000, now + 10_000)).toBe(false);
  });

  it("returns true when duration exceeds threshold", () => {
    const state = idle(now);
    expect(isStale(state, 30_000, now + 40_000)).toBe(true);
  });

  it("uses default threshold of 30000ms", () => {
    const state = idle(now);
    expect(isStale(state, undefined, now + 25_000)).toBe(false);
    expect(isStale(state, undefined, now + 35_000)).toBe(true);
  });

  it("never stale for reflecting state (duration = 0)", () => {
    const state = reflecting(
      { _: "success", result: null, duration: 10 },
      "a",
      "b"
    );
    expect(isStale(state, 1, now + 100_000)).toBe(false);
  });
});
