import {
  ToolLoopAgent,
  type InferAgentUIMessage,
  stepCountIs,
  type PrepareStepFunction,
  type ToolLoopAgentSettings,
} from "ai";

import { buildAssistantTools, buildTools, getModelId, getOpenAI } from "./v6";

const ASSISTANT_MAX_STEPS = 12;
const ORCHESTRATOR_MAX_STEPS = 12;

type AssistantTools = ReturnType<typeof buildAssistantTools>;
type OrchestratorTools = ReturnType<typeof buildTools>;

const assistantPrepareStep: PrepareStepFunction<AssistantTools> = async ({
  messages,
}) => {
  if (messages.length > 40) {
    return {
      messages: [messages[0], ...messages.slice(-20)],
    };
  }
  return {};
};

const orchestratorPrepareStep: PrepareStepFunction<OrchestratorTools> = async ({
  messages,
  stepNumber,
  steps,
}) => {
  if (messages.length > 60) {
    return {
      messages: [messages[0], ...messages.slice(-30)],
    };
  }
  const hasToolCall =
    steps.flatMap((step) => step.toolCalls ?? []).length > 0 &&
    stepNumber <= 3;
  if (hasToolCall) {
    return {
      toolChoice: { type: "tool", toolName: "summarize" },
    };
  }
  return {};
};

const assistantConfig: ToolLoopAgentSettings<never, AssistantTools> = {
  model: getOpenAI().chat(getModelId()),
  tools: buildAssistantTools(),
  stopWhen: stepCountIs(ASSISTANT_MAX_STEPS),
  prepareStep: assistantPrepareStep,
};

const orchestratorConfig: ToolLoopAgentSettings<never, OrchestratorTools> = {
  model: getOpenAI().chat(getModelId()),
  tools: buildTools(),
  stopWhen: stepCountIs(ORCHESTRATOR_MAX_STEPS),
  prepareStep: orchestratorPrepareStep,
};

const assistantDefaults = {
  model: assistantConfig.model,
  tools: assistantConfig.tools,
  stopWhen: assistantConfig.stopWhen,
} as const;

const orchestratorDefaults = {
  model: orchestratorConfig.model,
  tools: orchestratorConfig.tools,
  stopWhen: orchestratorConfig.stopWhen,
} as const;

export const assistantAgent = new ToolLoopAgent(assistantConfig);
export const orchestratorAgent = new ToolLoopAgent(orchestratorConfig);

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
