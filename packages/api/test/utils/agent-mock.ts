import { mock, vi } from "bun:test";

const noop = vi.fn().mockResolvedValue(undefined);

export const assistantAgentMock = {
  generate: vi.fn().mockResolvedValue({ text: "", toolCalls: [], usage: null }),
  stream: vi.fn().mockResolvedValue({
    runId: null,
    _getBaseStream: () => undefined,
    getFullOutput: async () => ({ text: "", toolCalls: [], usage: null }),
  }),
};

export const mastraMock = {
  pubsub: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
  getWorkflow: vi.fn(),
  generateId: vi.fn().mockReturnValue("test-run"),
};

export function resetAgentMocks() {
  assistantAgentMock.generate.mockReset();
  assistantAgentMock.generate.mockResolvedValue({ text: "", toolCalls: [], usage: null });
  assistantAgentMock.stream.mockReset();
  assistantAgentMock.stream.mockResolvedValue({
    runId: null,
    _getBaseStream: () => undefined,
    getFullOutput: async () => ({ text: "", toolCalls: [], usage: null }),
  });
  mastraMock.pubsub.publish.mockReset();
  mastraMock.pubsub.publish.mockResolvedValue(undefined);
  mastraMock.getWorkflow.mockReset();
  mastraMock.generateId.mockReset();
  mastraMock.generateId.mockReturnValue("test-run");
}

mock.module("@alfred/agent", () => ({
  assistantAgent: assistantAgentMock,
  orchestratorAgent: {},
  mastra: mastraMock,
  planWorkflow: vi.fn(),
  toolDroid: {},
  toolDocker: {},
  toolRouter: {},
  runEval: vi.fn(),
  registerDroidExecCounter: noop,
  registerDroidExecHistogram: noop,
  registerEvalRunsCounter: noop,
  registerEvalDurationHistogram: noop,
  registerEvalScoreCounter: noop,
  registerEvalFailureCounter: noop,
  registerLaminarDatapointCounter: noop,
  registerLaminarErrorCounter: noop,
  registerAssistantToolCounter: noop,
  registerAssistantEscalationCounter: noop,
  registerMemoryUpdatesCounter: noop,
  registerMemoryForgetsCounter: noop,
  recordMemoryUpdate: noop,
  recordMemoryForget: noop,
}));
