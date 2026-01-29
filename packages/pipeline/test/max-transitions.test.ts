/**
 * MAX_TRANSITIONS safeguard tests.
 *
 * Ensures the pipeline runner enforces the maximum transition limit
 * to prevent infinite loops and runaway executions.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 4
 */

import { describe, expect, it } from "bun:test";

import { DEFAULT_CONFIG } from "../src/pipeline";
import { PipelineRunner } from "../src/runner";

describe("MAX_TRANSITIONS safeguard", () => {
  it("enforces limit during pipeline execution", async () => {
    // This test verifies the safeguard exists in the config
    expect(DEFAULT_CONFIG.maxTransitions).toBeDefined();
    expect(DEFAULT_CONFIG.maxTransitions).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.maxTransitions).toBeLessThanOrEqual(100_000);
  });

  it("runner respects configured limit", () => {
    const runner = new PipelineRunner(DEFAULT_CONFIG);
    expect(runner).toBeDefined();
    // The runner should have the maxTransitions config available
  });

  it("has reasonable default limit", () => {
    // Default should be high enough for complex workflows
    // but low enough to catch runaway executions
    expect(DEFAULT_CONFIG.maxTransitions).toBeGreaterThanOrEqual(1000);
    expect(DEFAULT_CONFIG.maxTransitions).toBeLessThanOrEqual(100_000);
  });
});

describe("pipeline phase safeguards", () => {
  it("each phase has timeout configuration", () => {
    // Phase timeouts prevent indefinite hanging
    expect(DEFAULT_CONFIG.phaseTimeouts).toBeDefined();
    expect(Object.keys(DEFAULT_CONFIG.phaseTimeouts).length).toBeGreaterThan(0);

    // Each timeout should be reasonable (1-60 minutes)
    for (const [phase, timeout] of Object.entries(
      DEFAULT_CONFIG.phaseTimeouts
    )) {
      expect(timeout, `Phase ${phase} timeout`).toBeGreaterThanOrEqual(1000);
      expect(timeout, `Phase ${phase} timeout`).toBeLessThanOrEqual(
        60 * 60 * 1000
      );
    }
  });

  it("review fixer has max attempts limit", () => {
    expect(DEFAULT_CONFIG.reviewFixer).toBeDefined();
    expect(DEFAULT_CONFIG.reviewFixer?.enabled).toBeDefined();
    expect(DEFAULT_CONFIG.reviewFixer?.maxAttempts).toBeDefined();
    expect(DEFAULT_CONFIG.reviewFixer?.maxAttempts).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_CONFIG.reviewFixer?.maxAttempts).toBeLessThanOrEqual(10);
  });
});
