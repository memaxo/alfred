import { mock, vi } from "bun:test";

const noop = vi.fn().mockResolvedValue(undefined);

const assistantTools = {};
const orchestratorTools = {};

const getOpenAI = vi.fn(() => ({
  chat: vi.fn(() => ({ id: "mock-model" })),
}));

const getModelId = vi.fn(() => "mock-model");

const buildAssistantTools = vi.fn(() => assistantTools);
const buildOrchestratorTools = vi.fn(() => orchestratorTools);
const buildTools = vi.fn(() => orchestratorTools);
const wrapLegacyToolToAISDK = vi.fn();

const assistantDefaults = {
  model: { id: "assistant-model" },
  tools: assistantTools,
  stopWhen: vi.fn(),
};

const orchestratorDefaults = {
  model: { id: "orchestrator-model" },
  tools: orchestratorTools,
  stopWhen: vi.fn(),
};

const getAssistantAgentDefaults = vi.fn(() => assistantDefaults);
const getOrchestratorAgentDefaults = vi.fn(() => orchestratorDefaults);

mock.module("@alfred/agent", () => ({
  buildAssistantTools,
  buildOrchestratorTools,
  buildTools,
  getOpenAI,
  getModelId,
  getAssistantAgentDefaults,
  getOrchestratorAgentDefaults,
  wrapLegacyToolToAISDK,
  registerCodexExecCounter: noop,
  registerCodexExecHistogram: noop,
  registerCodexErrorCounter: noop,
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
  recordCodexExecRun: noop,
  recordCodexError: noop,
  recordAssistantToolCall: noop,
  recordAssistantEscalation: noop,
  recordMemoryUpdate: noop,
  recordMemoryForget: noop,
}));

export function resetAgentMocks() {
  getOpenAI.mockClear();
  getModelId.mockClear();
  buildAssistantTools.mockClear();
  buildOrchestratorTools.mockClear();
  buildTools.mockClear();
  wrapLegacyToolToAISDK.mockClear();
  getAssistantAgentDefaults.mockClear();
  getOrchestratorAgentDefaults.mockClear();
  assistantDefaults.stopWhen.mockClear();
  orchestratorDefaults.stopWhen.mockClear();
}

export {
  buildAssistantTools as buildAssistantToolsMock,
  buildOrchestratorTools as buildOrchestratorToolsMock,
  buildTools as buildToolsMock,
  getAssistantAgentDefaults as getAssistantAgentDefaultsMock,
  getOrchestratorAgentDefaults as getOrchestratorAgentDefaultsMock,
  getOpenAI as getOpenAIMock,
  getModelId as getModelIdMock,
};
