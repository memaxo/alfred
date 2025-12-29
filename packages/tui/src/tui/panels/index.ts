/**
 * ALFRED TUI Panels Module
 *
 * Explicit exports to avoid symbol conflicts between domain panels
 */

// AgentFS panel - explicit exports
export {
  AgentFSPanel,
  createAgentFSPanel,
} from "./agentfs";
// Base panel types
export * from "./base";
// Cognitive panel - explicit exports
export {
  CognitivePanel,
  createCognitivePanel,
} from "./cognitive";
// Chrome panels
export * from "./header";
// Knowledge panel - explicit exports
export {
  createKnowledgePanel,
  KnowledgePanel,
} from "./knowledge";
// Metrics panel - explicit exports
export {
  createMetricsPanel,
  MetricsPanel,
} from "./metrics";

export * from "./shortcuts";
export * from "./status";

// Voice panel - explicit exports
export {
  createVoicePanel,
  VoicePanel,
} from "./voice";

// Workflow panel - explicit exports
export {
  createWorkflowPanel,
  WorkflowPanel,
} from "./workflow";
