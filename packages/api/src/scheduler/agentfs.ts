// AgentFS Scheduler
// Backward-compatible re-exports from modular structure
// DEPRECATED: Import directly from scheduler/agentfs/{cleanup,integrity,compact}

// Re-export from cleanup module
export {
  runCleanupTick as runAgentfsCleanupTick,
  startCleanupScheduler as startAgentfsCleanupScheduler,
  stopCleanupScheduler as stopAgentfsCleanupScheduler,
  type CleanupResult,
  type CleanupSchedulerOptions as AgentfsCleanupSchedulerOptions,
} from "./agentfs/cleanup";

// Re-export from integrity module
export {
  runIntegrityTick as runAgentfsIntegrityTick,
  startIntegrityScheduler as startAgentfsIntegrityScheduler,
  stopIntegrityScheduler as stopAgentfsIntegrityScheduler,
  type IntegrityResult,
  type IntegritySchedulerOptions as AgentfsIntegritySchedulerOptions,
} from "./agentfs/integrity";

// Re-export from compact module
export {
  runCompactTick as runAgentfsCompactTick,
  startCompactScheduler as startAgentfsCompactScheduler,
  stopCompactScheduler as stopAgentfsCompactScheduler,
  type CompactResult,
  type CompactSchedulerOptions as AgentfsCompactSchedulerOptions,
} from "./agentfs/compact";

// Re-export from agentfscas
export { touchAgentfsCasLastAccessed } from "../agentfscas";
