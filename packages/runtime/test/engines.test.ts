/**
 * Engine Wrapper Integration Tests
 *
 * Tests that engine wrappers correctly call domain package functions
 */

import { empty as emptyGraph } from "@alfred/knowledge/hypergraph";
import { describe, expect, it } from "bun:test";

import { CognitiveEngine } from "../src/engines/cognitive";
import { KnowledgeEngine } from "../src/engines/knowledge";
import { LearningEngine } from "../src/engines/learning";
import { PolicyEngine } from "../src/engines/policy";

describe("CognitiveEngine", () => {
  const engine = new CognitiveEngine();

  it("creates idle state", () => {
    const state = engine.idle();
    expect(state._).toBe("idle");
    expect(state.since).toBeGreaterThan(0);
  });

  it("creates capturing state", () => {
    const state = engine.capture("test input", 0.9);
    expect(state._).toBe("capturing");
    expect((state as any).input).toBe("test input");
    expect((state as any).confidence).toBe(0.9);
  });

  it("creates thinking state", () => {
    const state = engine.think("problem", 2, ["trace1", "trace2"]);
    expect(state._).toBe("thinking");
    expect((state as any).about).toBe("problem");
    expect((state as any).depth).toBe(2);
  });

  it("creates deciding state", () => {
    const state = engine.decide([]);
    expect(state._).toBe("deciding");
    expect((state as any).options).toEqual([]);
  });

  it("creates executing state", () => {
    const plan = { steps: [], duration: 1000, confidence: 0.8 as any };
    const autonomy = 0.5 as any;
    const state = engine.execute(plan, autonomy);
    expect(state._).toBe("executing");
    expect((state as any).plan).toBe(plan);
  });

  it("creates reflecting state", () => {
    const outcome = { _: "success", result: {}, duration: 100 } as any;
    const state = engine.reflect(outcome, "expected", "actual");
    expect(state._).toBe("reflecting");
    expect((state as any).outcome).toBe(outcome);
  });
});

describe("KnowledgeEngine", () => {
  const engine = new KnowledgeEngine();
  const graph = emptyGraph();

  it("executes datalog query", () => {
    const results = engine.query("find ?x where fact(?x)", graph);
    expect(Array.isArray(results)).toBe(true);
  });

  it("executes semantic query", async () => {
    const results = await engine.semanticQuery("test query", graph, 5);
    expect(Array.isArray(results)).toBe(true);
  });

  it("executes pattern match", () => {
    const results = engine.match("find ?x where fact(?x)", graph);
    expect(Array.isArray(results)).toBe(true);
  });
});

describe("LearningEngine", () => {
  const engine = new LearningEngine();

  it("records outcomes", () => {
    const outcome = {
      input: "test",
      output: "result",
      expected: "result",
      error: 0,
      context: {},
      ts: new Date().toISOString(),
    };

    engine.recordOutcome(outcome);
    expect(engine.getOutcomeCount()).toBe(1);
  });

  it("processes multiple outcomes", () => {
    const engine2 = new LearningEngine();

    engine2.recordOutcome({
      input: "test1",
      output: "result1",
      expected: "result1",
      error: 0,
      context: {},
      ts: new Date().toISOString(),
    });

    engine2.recordOutcome({
      input: "test2",
      output: "result2",
      expected: "result2",
      error: 1,
      context: {},
      ts: new Date().toISOString(),
    });

    expect(engine2.getOutcomeCount()).toBe(2);
  });

  it("processes outcomes and returns updates", async () => {
    const engine3 = new LearningEngine();

    engine3.recordOutcome({
      input: "test",
      output: "result",
      expected: "result",
      error: 0,
      context: {},
      ts: new Date().toISOString(),
    });

    const updates = await engine3.processOutcomes();
    expect(Array.isArray(updates)).toBe(true);
  });

  it("clears outcomes", () => {
    const engine4 = new LearningEngine();
    engine4.recordOutcome({
      input: "test",
      output: "result",
      expected: "result",
      error: 0,
      context: {},
      ts: new Date().toISOString(),
    });

    expect(engine4.getOutcomeCount()).toBe(1);
    engine4.clear();
    expect(engine4.getOutcomeCount()).toBe(0);
  });
});

describe("PolicyEngine", () => {
  const engine = new PolicyEngine();

  it("evaluates policy decision (requires policy.yaml)", async () => {
    // This test requires config/policy.yaml to be present
    // Will be enabled in integration test suite
    const decision = await engine.evaluate({
      subject: { id: "user1", roles: ["owner"] },
      action: "note.read",
      resource: { kind: "note", id: "note1" },
    });

    expect(decision).toHaveProperty("allow");
    expect(decision).toHaveProperty("obligations");
    expect(typeof decision.allow).toBe("boolean");
  });

  it("checks if action is permitted (requires policy.yaml)", async () => {
    // This test requires config/policy.yaml to be present
    // Will be enabled in integration test suite
    const permitted = await engine.isPermitted({
      subject: { id: "user1", roles: ["owner"] },
      action: "note.read",
      resource: { kind: "note", id: "note1" },
    });

    expect(typeof permitted).toBe("boolean");
  });

  it("gets obligations for action (requires policy.yaml)", async () => {
    // This test requires config/policy.yaml to be present
    // Will be enabled in integration test suite
    const obligations = await engine.getObligations({
      subject: { id: "user1", roles: ["owner"] },
      action: "note.read",
      resource: { kind: "note", id: "note1" },
    });

    expect(Array.isArray(obligations)).toBe(true);
  });

  it("has correct interface", () => {
    // Just verify the engine has the expected methods
    expect(typeof engine.evaluate).toBe("function");
    expect(typeof engine.isPermitted).toBe("function");
    expect(typeof engine.getObligations).toBe("function");
  });
});
