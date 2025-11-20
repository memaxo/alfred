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
  it("memoizes assistant defaults", () => {
    const { getAssistantAgentDefaults } = agentsModule;
    const first = getAssistantAgentDefaults();
    const second = getAssistantAgentDefaults();
    expect(first).toBe(second);
    expect(typeof first.stopWhen).toBe("function");
    expect(first.tools).toBeTruthy();
  });

  it("memoizes orchestrator defaults", () => {
    const { getOrchestratorAgentDefaults } = agentsModule;
    const first = getOrchestratorAgentDefaults();
    const second = getOrchestratorAgentDefaults();
    expect(first).toBe(second);
    expect(typeof first.stopWhen).toBe("function");
    expect(first.tools).toBeTruthy();
  });

  it("instantiates ToolLoopAgents with shared defaults", () => {
    const {
      assistantAgent,
      orchestratorAgent,
      getAssistantAgentDefaults,
      getOrchestratorAgentDefaults,
    } = agentsModule;
    expect(assistantAgent.tools).toEqual(getAssistantAgentDefaults().tools);
    expect(orchestratorAgent.tools).toEqual(getOrchestratorAgentDefaults().tools);
  });
});
