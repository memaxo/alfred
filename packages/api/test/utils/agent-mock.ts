import { mock, vi } from "bun:test";

const noop = vi.fn().mockResolvedValue(undefined);

const getOpenAI = vi.fn(() => ({
  chat: vi.fn(() => ({ id: "mock-model" })),
}));

const getModelId = vi.fn(() => "mock-model");

const buildAssistantTools = vi.fn(() => ({}));
const buildOrchestratorTools = vi.fn(() => ({}));
const wrapLegacyToolToAISDK = vi.fn();

mock.module("@alfred/agent", () => ({
  buildAssistantTools,
  buildOrchestratorTools,
  getOpenAI,
  getModelId,
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
  wrapLegacyToolToAISDK.mockClear();
}
