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

const assistantInstructions = [
  "You are Alfred, a single-user cognitive co-pilot.",
  "Offer direct, actionable responses and prefer concrete steps over small talk.",
  "Only explain tool calls when the user needs the reasoning.",
].join(" ");

const orchestratorInstructions = [
  "You orchestrate complex workflows for the same single user.",
  "Plan out the next best action, then execute it through tools with concise status updates.",
  "Surface blockers immediately so the user can intervene.",
].join(" ");

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
}) => {
  if (messages.length > 60) {
    return {
      messages: [messages[0], ...messages.slice(-30)],
    };
  }
  return {};
};

const assistantTools = buildAssistantTools();
const orchestratorTools = buildTools();

const assistantStopWhen = stepCountIs(ASSISTANT_MAX_STEPS);
const orchestratorStopWhen = stepCountIs(ORCHESTRATOR_MAX_STEPS);

const assistantConfig: ToolLoopAgentSettings<never, AssistantTools> = {
  model: getOpenAI().chat(getModelId()),
  tools: assistantTools,
  instructions: assistantInstructions,
  stopWhen: assistantStopWhen,
  prepareStep: assistantPrepareStep,
};

const orchestratorConfig: ToolLoopAgentSettings<never, OrchestratorTools> = {
  model: getOpenAI().chat(getModelId()),
  tools: orchestratorTools,
  instructions: orchestratorInstructions,
  stopWhen: orchestratorStopWhen,
  prepareStep: orchestratorPrepareStep,
};

function createAssistantDefaults() {
  return {
    model: getOpenAI().chat(getModelId()),
    tools: assistantTools,
    instructions: assistantInstructions,
    stopWhen: assistantStopWhen,
    prepareStep: assistantPrepareStep,
  } as const;
}

function createOrchestratorDefaults() {
  return {
    model: getOpenAI().chat(getModelId()),
    tools: orchestratorTools,
    instructions: orchestratorInstructions,
    stopWhen: orchestratorStopWhen,
    prepareStep: orchestratorPrepareStep,
  } as const;
}

export const assistantAgent = new ToolLoopAgent(assistantConfig);
export const orchestratorAgent = new ToolLoopAgent(orchestratorConfig);

export function getAssistantAgentDefaults() {
  return createAssistantDefaults();
}

export function getOrchestratorAgentDefaults() {
  return createOrchestratorDefaults();
}

export type AssistantUIMessage = InferAgentUIMessage<typeof assistantAgent>;
export type OrchestratorUIMessage = InferAgentUIMessage<typeof orchestratorAgent>;

// Expose constants for downstream tuning/testing when required.
export const ASSISTANT_AGENT_MAX_STEPS = ASSISTANT_MAX_STEPS;
export const ORCHESTRATOR_AGENT_MAX_STEPS = ORCHESTRATOR_MAX_STEPS;
