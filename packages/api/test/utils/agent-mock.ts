import { mock, vi } from "bun:test";

const noop = vi.fn().mockResolvedValue();
const noopTimer = vi.fn(() => () => {});

const assistantTools = {};
const orchestratorTools = {};

const mockModel = { id: "mock-model" };
const gatewayProvider = Object.assign(((_: string) => mockModel) as any, {
  languageModel: (_: string) => mockModel,
  chat: (_: string) => mockModel,
});
const getOpenAI = vi.fn(() => gatewayProvider);

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
const voiceDefaults = {
  model: { id: "voice-model", modelId: "voice-model" },
  tools: orchestratorTools,
  stopWhen: vi.fn(),
  prepareStep: vi.fn(),
  instructions: "voice_agent_defaults",
};
const getVoiceAgentDefaults = vi.fn(() => voiceDefaults);

const getModelForRole = vi.fn(
  (role: string, opts?: { userId?: string; projectId?: string }) => {
    const selection =
      role === "orchestrator"
        ? { model: orchestratorDefaults.model, modelKey: "openai/orchestrator" }
        : role === "voice"
          ? { model: voiceDefaults.model, modelKey: "openai/voice" }
          : { model: assistantDefaults.model, modelKey: "openai/assistant" };

    if (opts && typeof opts === "object" && typeof opts.userId === "string") {
      return Promise.resolve(selection);
    }
    return selection;
  }
);
const recordMemoryUpdate = vi.fn();
const recordMemoryForget = vi.fn();
const recordPolicyCheckFailure = vi.fn();

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

// Some API routers import lightweight metrics helpers directly.
mock.module("@alfred/agent/metrics", () => ({
  // Keep this export surface wide so any codepath that imports agent metrics
  // in API tests won't crash due to missing named exports.
  registerDroidExecCounter: vi.fn(),
  registerDroidExecHistogram: vi.fn(),
  recordDroidExecRun: vi.fn(),
  startDroidExecTimer: noopTimer,

  registerCodexExecCounter: vi.fn(),
  registerCodexExecHistogram: vi.fn(),
  recordCodexExecRun: vi.fn(),
  startCodexExecTimer: noopTimer,

  registerCodexErrorCounter: vi.fn(),
  recordCodexError: vi.fn(),
  registerCodexWriterErrorCounter: vi.fn(),
  recordCodexWriterError: vi.fn(),
  registerCodexSessionViolationCounter: vi.fn(),
  recordCodexSessionViolation: vi.fn(),
  registerCodexSessionValidationHistogram: vi.fn(),
  startCodexSessionValidationTimer: noopTimer,

  registerEvalRunsCounter: vi.fn(),
  registerEvalDurationHistogram: vi.fn(),
  registerEvalScoreCounter: vi.fn(),
  registerEvalFailureCounter: vi.fn(),
  registerLaminarDatapointCounter: vi.fn(),
  registerLaminarErrorCounter: vi.fn(),
  recordEvalRunStatus: vi.fn(),
  startEvalRunTimer: noopTimer,
  recordEvalScore: vi.fn(),
  recordEvalFailure: vi.fn(),
  recordLaminarDatapoint: vi.fn(),
  recordLaminarError: vi.fn(),

  registerAssistantToolCounter: vi.fn(),
  recordAssistantToolCall: vi.fn(),
  registerAssistantEscalationCounter: vi.fn(),
  recordAssistantEscalation: vi.fn(),

  registerPolicyCheckFailureCounter: vi.fn(),
  recordMemoryUpdate,
  recordMemoryForget,
  recordPolicyCheckFailure,

  registerMemoryUpdatesCounter: vi.fn(),
  registerMemoryForgetsCounter: vi.fn(),

  registerCompressionCycleHistogram: vi.fn(),
  startCompressionCycleTimer: noopTimer,
  registerCompressionCycleCounter: vi.fn(),
  recordCompressionCycle: vi.fn(),
  registerCompressionNodeCounter: vi.fn(),
  recordCompressionNodeUpdate: vi.fn(),

  registerMemoryToolCounter: vi.fn(),
  recordMemoryToolCall: vi.fn(),
  registerMemorySearchLatencyHistogram: vi.fn(),
  recordMemorySearchLatency: vi.fn(),
  registerMemorySearchResultsHistogram: vi.fn(),
  recordMemorySearchResults: vi.fn(),
  registerMemoryTraverseDepthHistogram: vi.fn(),
  recordMemoryTraverseDepth: vi.fn(),
  registerMemoryBoostCounter: vi.fn(),
  recordMemoryBoost: vi.fn(),
  registerMemoryRemovalCounter: vi.fn(),
  recordMemoryRemoval: vi.fn(),
}));

// Some API routes import agent defaults via the dedicated module.
mock.module("@alfred/agent/agents", () => ({
  getAssistantAgentDefaults,
  getOrchestratorAgentDefaults,
  getVoiceAgentDefaults,
}));

mock.module("@alfred/agent/selector", () => ({
  getModelForRole,
}));

// Some runtime modules import the v6 tool builder directly. Provide a stable stub
// so tests don't pull in the full tool catalog (and its AI SDK dependencies).
mock.module("@alfred/agent/v6", () => ({
  buildAssistantTools,
  buildTools,
  getOpenAI,
  getModelId,
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
  getVoiceAgentDefaults.mockClear();
  getModelForRole.mockClear();
  assistantDefaults.stopWhen.mockClear();
  assistantDefaults.prepareStep.mockClear();
  orchestratorDefaults.stopWhen.mockClear();
  orchestratorDefaults.prepareStep.mockClear();
  voiceDefaults.stopWhen.mockClear();
  voiceDefaults.prepareStep.mockClear();
  noopTimer.mockClear();
  recordMemoryUpdate.mockClear();
  recordMemoryForget.mockClear();
  recordPolicyCheckFailure.mockClear();
}

export {
  buildAssistantTools as buildAssistantToolsMock,
  buildOrchestratorTools as buildOrchestratorToolsMock,
  buildTools as buildToolsMock,
  getAssistantAgentDefaults as getAssistantAgentDefaultsMock,
  getOrchestratorAgentDefaults as getOrchestratorAgentDefaultsMock,
  getVoiceAgentDefaults as getVoiceAgentDefaultsMock,
  getModelForRole as getModelForRoleMock,
  getOpenAI as getOpenAIMock,
  getModelId as getModelIdMock,
  recordMemoryUpdate as recordMemoryUpdateMock,
  recordMemoryForget as recordMemoryForgetMock,
  recordPolicyCheckFailure as recordPolicyCheckFailureMock,
};
