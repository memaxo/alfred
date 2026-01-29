// AgentFS Domain Module
// Content-addressed storage and retention management for AgentFS

export type {
  AgeBasis,
  AgeDetails,
  AutopinDetails,
  CasCleanupContext,
  CasEntry,
  CasRetentionPolicy,
  CleanupContext,
  CleanupResult,
  KeepDetails,
  OrphanedDetails,
  RetentionDecision,
  RetentionDetails,
  RetentionPolicy,
  RunEntry,
  SizeCapDetails,
} from "./domain";

export {
  calculateCutoffMs,
  checkCasSizeCap,
  checkRunSizeCap,
  decideCasRetention,
  decideRunRetention,
  evaluateCasBatch,
  evaluateRunBatch,
  parseCasMaxBytes,
  parseCasRetentionDays,
  parseMaxBytes,
  parseRetentionDays,
  shouldAutopinFailures,
  shouldDryRunCleanup,
  sortCasByPriority,
  sortRunsByAge,
} from "./policy";
