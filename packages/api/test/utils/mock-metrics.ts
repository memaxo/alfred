import { mock, vi } from "bun:test";

const counter = () => ({ inc: vi.fn(), labels: (..._args: any[]) => ({ inc: vi.fn() }) });
const histogram = () => ({
  startTimer: vi.fn().mockReturnValue(() => {}),
  observe: vi.fn(),
  labels: (..._args: any[]) => ({ observe: vi.fn() }),
});

export const metricsStub = {
  // tRPC
  trpcRequestsTotal: counter(),
  trpcRequestErrorsTotal: counter(),
  trpcRequestDurationSeconds: histogram(),

  // Policy
  policyDecisionsTotal: counter(),
  policyObligationsTotal: counter(),

  // Rate limit
  rateLimitHitsTotal: counter(),

  // Stream
  workflowStreamEventsTotal: counter(),
  workflowStreamDurationSeconds: histogram(),
  replayQueriesTotal: counter(),
  replayQueryDurationSeconds: histogram(),
  runnerStepsTotal: counter(),
  runnerErrorsTotal: counter(),
  linearActivityEmissionsTotal: counter(),
  linearActivityDurationSeconds: histogram(),
  linearSessionOperationsTotal: counter(),
  linearWebhookEventsTotal: counter(),
  linearWebhookWorkflowStartsTotal: counter(),
  linearWebhookWorkflowCancelsTotal: counter(),

  // Misc (provide stubs to satisfy imports)
  runRegistryEventsTotal: counter(),
  runRegistryDispatchDurationSeconds: histogram(),
  droidExecRunsTotal: counter(),
  droidExecDurationSeconds: histogram(),
  codexExecRunsTotal: counter(),
  codexExecDurationSeconds: histogram(),
  codexErrorsTotal: counter(),
  evalRunsTotal: counter(),
  evalDurationSeconds: histogram(),
  evalScoresTotal: counter(),
  evalFailuresTotal: counter(),
  laminarEvalDatapointsTotal: counter(),
  laminarEvalErrorsTotal: counter(),
  webhookEventsTotal: counter(),
  webhookErrorsTotal: counter(),
  assistantToolCallsTotal: counter(),
  assistantEscalationsTotal: counter(),
  memoryUpdatesTotal: counter(),
  memoryForgetsTotal: counter(),
  assistantGenerateRequestsTotal: counter(),
  assistantGenerateDurationSeconds: histogram(),
  orchestratorGenerateRequestsTotal: counter(),
  orchestratorGenerateDurationSeconds: histogram(),
  preferenceHistoryPrunedTotal: counter(),
  preferenceCacheInvalidationsTotal: counter(),
  preferenceRefreshTotal: counter(),
  preferencePromptInjectionsTotal: counter(),
  preferencePromptFailuresTotal: counter(),
  voiceSttTotal: counter(),
  voiceSttDurationSeconds: histogram(),
  recordVoiceStt: (_: any) => void 0,
  recordVoiceTts: (_: any) => void 0,
  compressionCyclesTotal: counter(),
  compressionCycleDurationSeconds: histogram(),
  compressionNodesUpdatedTotal: counter(),
  voiceStreamEventsTotal: counter(),
  voiceStreamLatencySeconds: histogram(),
} as const;

mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
}));

// Some modules import via source path; mock that too.
mock.module("@alfred/api/src/metrics", () => ({
  ...metricsStub,
}));

// Policy hooks used by metrics: provide default no-op implementations.
const defaultPolicyEvaluate = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] as string[] });
const defaultRegisterCacheObs = vi.fn();

export const policyStub = {
  evaluate: defaultPolicyEvaluate,
  registerCacheObs: defaultRegisterCacheObs,
} as const;

mock.module("@alfred/policy", () => ({
  ...policyStub,
}));
