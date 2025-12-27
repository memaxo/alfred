import { describe, expect, it } from "bun:test";

import { meetsConstraints } from "../src/autonomy/constraint";
import type { AutonomyGradient, Constraint } from "../src/autonomy/types";
import { initialAutonomy } from "../src/autonomy/update";
import { autonomy, confidence, timestamp } from "../src/util/math";

const baseNow = 1_700_000_000_000;

const createGradient = (constraints: Constraint[]): AutonomyGradient => ({
  level: autonomy(0.6),
  confidence: confidence(0.8),
  prior: { alpha: 2, beta: 5 },
  evidence: [],
  constraints,
  lastUpdate: timestamp(baseNow),
});

describe("meetsConstraints - temporal", () => {
  it("allows action before deadline", () => {
    const auto = createGradient([
      { _: "temporal", until: timestamp(baseNow + 10_000) },
    ]);
    const result = meetsConstraints(auto, "deploy", undefined, baseNow);
    expect(result.allowed).toBe(true);
  });

  it("blocks action after deadline", () => {
    const auto = createGradient([
      { _: "temporal", until: timestamp(baseNow - 1000) },
    ]);
    const result = meetsConstraints(auto, "deploy", undefined, baseNow);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("temporal_constraint_expired");
  });
});

describe("meetsConstraints - scope", () => {
  it("blocks forbidden actions", () => {
    const auto = createGradient([
      { _: "scope", allowed: [], forbidden: ["delete", "deploy"] },
    ]);
    const result = meetsConstraints(auto, "delete");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("action_forbidden");
  });

  it("allows non-forbidden actions", () => {
    const auto = createGradient([
      { _: "scope", allowed: [], forbidden: ["delete"] },
    ]);
    const result = meetsConstraints(auto, "read");
    expect(result.allowed).toBe(true);
  });

  it("blocks actions not in allowed list when list is non-empty", () => {
    const auto = createGradient([
      { _: "scope", allowed: ["read", "write"], forbidden: [] },
    ]);
    const result = meetsConstraints(auto, "delete");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("action_not_allowed");
  });

  it("allows actions in allowed list", () => {
    const auto = createGradient([
      { _: "scope", allowed: ["read", "write"], forbidden: [] },
    ]);
    const result = meetsConstraints(auto, "read");
    expect(result.allowed).toBe(true);
  });

  it("forbidden takes precedence over allowed", () => {
    const auto = createGradient([
      { _: "scope", allowed: ["deploy"], forbidden: ["deploy"] },
    ]);
    const result = meetsConstraints(auto, "deploy");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("action_forbidden");
  });
});

describe("meetsConstraints - confidence", () => {
  it("blocks when confidence below minimum", () => {
    const auto: AutonomyGradient = {
      level: autonomy(0.6),
      confidence: confidence(0.5),
      prior: { alpha: 2, beta: 5 },
      evidence: [],
      constraints: [{ _: "confidence", minimum: confidence(0.7) }],
      lastUpdate: timestamp(baseNow),
    };
    const result = meetsConstraints(auto, "deploy");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("confidence_below_minimum");
  });

  it("allows when confidence meets minimum", () => {
    const auto: AutonomyGradient = {
      level: autonomy(0.6),
      confidence: confidence(0.8),
      prior: { alpha: 2, beta: 5 },
      evidence: [],
      constraints: [{ _: "confidence", minimum: confidence(0.7) }],
      lastUpdate: timestamp(baseNow),
    };
    const result = meetsConstraints(auto, "deploy");
    expect(result.allowed).toBe(true);
  });
});

describe("meetsConstraints - approval", () => {
  it("blocks when approval required and level < 0.5", () => {
    const auto: AutonomyGradient = {
      level: autonomy(0.4),
      confidence: confidence(0.8),
      prior: { alpha: 2, beta: 5 },
      evidence: [],
      constraints: [{ _: "approval", required: true }],
      lastUpdate: timestamp(baseNow),
    };
    const result = meetsConstraints(auto, "deploy");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("approval_required");
  });

  it("allows when approval required and level >= 0.5", () => {
    const auto: AutonomyGradient = {
      level: autonomy(0.6),
      confidence: confidence(0.8),
      prior: { alpha: 2, beta: 5 },
      evidence: [],
      constraints: [{ _: "approval", required: true }],
      lastUpdate: timestamp(baseNow),
    };
    const result = meetsConstraints(auto, "deploy");
    expect(result.allowed).toBe(true);
  });

  it("allows when approval not required", () => {
    const auto: AutonomyGradient = {
      level: autonomy(0.3),
      confidence: confidence(0.8),
      prior: { alpha: 2, beta: 5 },
      evidence: [],
      constraints: [{ _: "approval", required: false }],
      lastUpdate: timestamp(baseNow),
    };
    const result = meetsConstraints(auto, "deploy");
    expect(result.allowed).toBe(true);
  });
});

describe("meetsConstraints - physiology", () => {
  it("blocks on high frustration (> 0.85)", () => {
    const auto = initialAutonomy(baseNow);
    const result = meetsConstraints(auto, "deploy", {
      energy: 1,
      boredom: 0,
      frustration: 0.9,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("frustration_threshold_exceeded");
  });

  it("blocks on low energy (< 0.1)", () => {
    const auto = initialAutonomy(baseNow);
    const result = meetsConstraints(auto, "deploy", {
      energy: 0.05,
      boredom: 0,
      frustration: 0,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("energy_depleted");
  });

  it("blocks on high boredom (> 0.9)", () => {
    const auto = initialAutonomy(baseNow);
    const result = meetsConstraints(auto, "deploy", {
      energy: 1,
      boredom: 0.95,
      frustration: 0,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("boredom_loop_detected");
  });

  it("physiology checks run before constraint checks", () => {
    const auto: AutonomyGradient = {
      level: autonomy(0.6),
      confidence: confidence(0.8),
      prior: { alpha: 2, beta: 5 },
      evidence: [],
      constraints: [{ _: "approval", required: true }],
      lastUpdate: timestamp(baseNow),
    };
    // Would pass approval but fail physiology
    const result = meetsConstraints(auto, "deploy", {
      energy: 0.05,
      boredom: 0,
      frustration: 0,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("energy_depleted");
  });
});

describe("meetsConstraints - multiple constraints", () => {
  it("fails on first failing constraint", () => {
    const auto = createGradient([
      { _: "temporal", until: timestamp(baseNow - 1000) },
      { _: "scope", allowed: [], forbidden: ["deploy"] },
    ]);
    const result = meetsConstraints(auto, "deploy", undefined, baseNow);
    // temporal is checked first
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("temporal_constraint_expired");
  });

  it("passes when all constraints pass", () => {
    const auto = createGradient([
      { _: "temporal", until: timestamp(baseNow + 10_000) },
      { _: "scope", allowed: ["deploy"], forbidden: [] },
    ]);
    const result = meetsConstraints(auto, "deploy", undefined, baseNow);
    expect(result.allowed).toBe(true);
  });
});
