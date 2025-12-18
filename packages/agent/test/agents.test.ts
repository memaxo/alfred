import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

// Set up environment BEFORE any imports to ensure consistent module initialization
// This is critical for test isolation when running with --only-failures
const originalApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = originalApiKey ?? "test-key";

// Import agents module - env is already set up
let agentsModule: typeof import("../src/agents");

beforeAll(async () => {
  // Force fresh import of the agents module
  agentsModule = await import("../src/agents");
});

afterAll(() => {
  // Restore original API key
  if (originalApiKey === undefined) {
    process.env.OPENAI_API_KEY = undefined;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
  mock.restore();
});

describe("agent defaults", () => {
  it("returns fresh assistant defaults while sharing static references", () => {
    const { getAssistantAgentDefaults } = agentsModule;
    const first = getAssistantAgentDefaults();
    const second = getAssistantAgentDefaults();
    expect(first).not.toBe(second);
    expect(first.stopWhen).toBe(second.stopWhen);
    expect(first.tools).toBe(second.tools);
    // prepareStep should be defined and be a function
    expect(first.prepareStep).toBeDefined();
    expect(typeof first.prepareStep).toBe("function");
    expect(typeof first.instructions).toBe("string");
  });

  it("returns fresh orchestrator defaults while sharing static references", () => {
    const { getOrchestratorAgentDefaults } = agentsModule;
    const first = getOrchestratorAgentDefaults();
    const second = getOrchestratorAgentDefaults();
    expect(first).not.toBe(second);
    expect(first.stopWhen).toBe(second.stopWhen);
    expect(first.tools).toBe(second.tools);
    // prepareStep should be defined and be a function
    expect(first.prepareStep).toBeDefined();
    expect(typeof first.prepareStep).toBe("function");
    expect(typeof first.instructions).toBe("string");
  });

  it("exposes tools through agent and defaults consistently", () => {
    const {
      assistantAgent,
      orchestratorAgent,
      getAssistantAgentDefaults,
      getOrchestratorAgentDefaults,
    } = agentsModule;
    const assistantDefaults = getAssistantAgentDefaults();
    const orchestratorDefaults = getOrchestratorAgentDefaults();

    // Verify assistant tools contain expected keys (not exact match to handle evolution)
    const assistantToolKeys = Object.keys(assistantAgent.tools);
    expect(assistantToolKeys.length).toBeGreaterThan(0);
    // Core assistant tools that should always be present
    expect(assistantToolKeys).toContain("note");
    expect(assistantToolKeys).toContain("remind");

    // Verify orchestrator tools contain expected keys
    const orchestratorToolKeys = Object.keys(orchestratorAgent.tools);
    expect(orchestratorToolKeys.length).toBeGreaterThan(0);
    // Core orchestrator tools that should always be present
    expect(orchestratorToolKeys).toContain("codex");
    expect(orchestratorToolKeys).toContain("git");

    // Defaults should have matching tools (same object reference)
    expect(assistantDefaults.tools).toBe(assistantAgent.tools);
    expect(orchestratorDefaults.tools).toBe(orchestratorAgent.tools);

    // Verify prepareStep and instructions are present
    expect(assistantDefaults.prepareStep).toBeDefined();
    expect(typeof assistantDefaults.prepareStep).toBe("function");
    expect(orchestratorDefaults.prepareStep).toBeDefined();
    expect(typeof orchestratorDefaults.prepareStep).toBe("function");
    expect(typeof assistantDefaults.instructions).toBe("string");
    expect(typeof orchestratorDefaults.instructions).toBe("string");
  });
});
