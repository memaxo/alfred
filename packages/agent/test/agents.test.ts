import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let originalApiKey: string | undefined;
let agentsModule: typeof import("../src/agents");

beforeAll(async () => {
  originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = originalApiKey ?? "test-key";
  agentsModule = await import("../src/agents");
});

afterAll(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

describe("agent defaults", () => {
  it("returns fresh assistant defaults while sharing static references", () => {
    const { getAssistantAgentDefaults } = agentsModule;
    const first = getAssistantAgentDefaults();
    const second = getAssistantAgentDefaults();
    expect(first).not.toBe(second);
    expect(first.stopWhen).toBe(second.stopWhen);
    expect(first.tools).toBe(second.tools);
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
    expect(typeof first.prepareStep).toBe("function");
    expect(typeof first.instructions).toBe("string");
  });

  it("instantiates ToolLoopAgents with shared defaults", () => {
    const {
      assistantAgent,
      orchestratorAgent,
      getAssistantAgentDefaults,
      getOrchestratorAgentDefaults,
    } = agentsModule;
    const assistantDefaults = getAssistantAgentDefaults();
    const orchestratorDefaults = getOrchestratorAgentDefaults();

    expect(assistantAgent.tools).toBe(assistantDefaults.tools);
    expect(orchestratorAgent.tools).toBe(orchestratorDefaults.tools);
    expect(assistantDefaults.prepareStep).toBeDefined();
    expect(orchestratorDefaults.prepareStep).toBeDefined();
    expect(typeof assistantDefaults.instructions).toBe("string");
    expect(typeof orchestratorDefaults.instructions).toBe("string");
  });
});
