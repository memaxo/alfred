import { mock, vi } from "bun:test";

const counter = () => ({ inc: vi.fn(), labels: (..._args: any[]) => ({ inc: vi.fn() }) });
const histogram = () => ({ startTimer: vi.fn().mockReturnValue(() => {}), labels: (..._args: any[]) => ({ observe: vi.fn() }) });

mock.module("@alfred/api/metrics", () => ({
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
  voiceSttTotal: counter(),
  voiceSttDurationSeconds: histogram(),
}));

