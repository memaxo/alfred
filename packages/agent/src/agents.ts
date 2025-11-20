import { ToolLoopAgent, type InferAgentUIMessage, stepCountIs } from "ai";

import { buildAssistantTools, buildTools, getModelId, getOpenAI } from "./v6";

const ASSISTANT_MAX_STEPS = 12;
const ORCHESTRATOR_MAX_STEPS = 12;

const assistantDefaults = {
  model: getOpenAI().chat(getModelId()),
  tools: buildAssistantTools(),
  stopWhen: stepCountIs(ASSISTANT_MAX_STEPS),
} as const;

const orchestratorDefaults = {
  model: getOpenAI().chat(getModelId()),
  tools: buildTools(),
  stopWhen: stepCountIs(ORCHESTRATOR_MAX_STEPS),
} as const;

export const assistantAgent = new ToolLoopAgent(assistantDefaults);
export const orchestratorAgent = new ToolLoopAgent(orchestratorDefaults);

export function getAssistantAgentDefaults() {
  return assistantDefaults;
}

export function getOrchestratorAgentDefaults() {
  return orchestratorDefaults;
}

export type AssistantUIMessage = InferAgentUIMessage<typeof assistantAgent>;
export type OrchestratorUIMessage = InferAgentUIMessage<typeof orchestratorAgent>;

// Expose constants for downstream tuning/testing when required.
export const ASSISTANT_AGENT_MAX_STEPS = ASSISTANT_MAX_STEPS;
export const ORCHESTRATOR_AGENT_MAX_STEPS = ORCHESTRATOR_MAX_STEPS;
