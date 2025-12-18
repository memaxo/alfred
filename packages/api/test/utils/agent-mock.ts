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
  model: { id: "assistant-model", modelId: "assistant-model" },
  tools: assistantTools,
  stopWhen: vi.fn(),
  prepareStep: vi.fn(),
};

const orchestratorDefaults = {
  model: { id: "orchestrator-model", modelId: "orchestrator-model" },
  tools: orchestratorTools,
  stopWhen: vi.fn(),
  prepareStep: vi.fn(),
};

const getAssistantAgentDefaults = vi.fn(() => assistantDefaults);
const getOrchestratorAgentDefaults = vi.fn(() => orchestratorDefaults);
const recordMemoryUpdate = vi.fn();
const recordMemoryForget = vi.fn();

mock.module("@alfred/agent", async () => {
  const normalizeAbs = new URL(
    "../../../agent/src/utils/normalize.ts",
    import.meta.url
  ).pathname;
  const normalize = await import(normalizeAbs);

  return {
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
  recordMemoryUpdate,
  recordMemoryForget,
    // Use real normalization helpers so tests exercising persistence/normalization
    // get realistic parts instead of empty arrays.
    eventToUiMessages: normalize.eventToUiMessages,
    normalizeToUiMessages: normalize.normalizeToUiMessages,
  };
});

// Some runtime modules import the v6 tool builder directly. Provide a stable stub
// so tests don't pull in the full tool catalog (and its AI SDK dependencies).
mock.module("@alfred/agent/v6", () => ({
  buildTools,
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
  assistantDefaults.prepareStep.mockClear();
  orchestratorDefaults.stopWhen.mockClear();
  orchestratorDefaults.prepareStep.mockClear();
  recordMemoryUpdate.mockClear();
  recordMemoryForget.mockClear();
}

export {
  buildAssistantTools as buildAssistantToolsMock,
  buildOrchestratorTools as buildOrchestratorToolsMock,
  buildTools as buildToolsMock,
  getAssistantAgentDefaults as getAssistantAgentDefaultsMock,
  getOrchestratorAgentDefaults as getOrchestratorAgentDefaultsMock,
  getOpenAI as getOpenAIMock,
  getModelId as getModelIdMock,
  recordMemoryUpdate as recordMemoryUpdateMock,
  recordMemoryForget as recordMemoryForgetMock,
};
