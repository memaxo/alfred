import {
  type InferAgentUIMessage,
  type LanguageModel,
  type PrepareStepFunction,
  stepCountIs,
  ToolLoopAgent,
  type ToolLoopAgentSettings,
} from "ai";

import { buildPersonaPrompt } from "@alfred/persona";
import { getModelForRole } from "./selector";
import { buildAssistantTools, buildTools } from "./v6";

// Type-safe model accessor that returns LanguageModel
type AgentModel = LanguageModel;

const ASSISTANT_MAX_STEPS = 12;
const ORCHESTRATOR_MAX_STEPS = 12;

type AssistantTools = ReturnType<typeof buildAssistantTools>;
type OrchestratorTools = ReturnType<typeof buildTools>;

const assistantInstructions = [
  buildPersonaPrompt({ modality: "text", honorific: "neutral" }),
  "Offer direct, actionable responses and prefer concrete steps over small talk.",
  "Only explain tool calls when the user needs the reasoning.",
].join("\n\n");

const orchestratorInstructions = [
  buildPersonaPrompt({ modality: "text", honorific: "neutral" }),
  "You orchestrate complex workflows for the same single user.",
  "Plan out the next best action, then execute it through tools with concise status updates.",
  "Surface blockers immediately so the user can intervene.",
].join("\n\n");

const assistantPrepareStep: PrepareStepFunction<AssistantTools> = ({
  messages,
}) => {
  if (messages.length > 40) {
    return Promise.resolve({
      messages: [messages[0], ...messages.slice(-20)].filter(
        (msg): msg is NonNullable<typeof msg> =>
          msg !== null && msg !== undefined
      ),
    });
  }
  return Promise.resolve({});
};

const orchestratorPrepareStep: PrepareStepFunction<OrchestratorTools> = ({
  messages,
}) => {
  if (messages.length > 60) {
    return Promise.resolve({
      messages: [messages[0], ...messages.slice(-30)].filter(
        (msg): msg is NonNullable<typeof msg> =>
          msg !== null && msg !== undefined
      ),
    });
  }
  return Promise.resolve({});
};

// Tools can be built at module load (no API key required)
const assistantTools = buildAssistantTools();
const orchestratorTools = buildTools();

const assistantStopWhen = stepCountIs(ASSISTANT_MAX_STEPS);
const orchestratorStopWhen = stepCountIs(ORCHESTRATOR_MAX_STEPS);

// Lazy-initialized agent singletons
let cachedAssistantAgent: ToolLoopAgent<AssistantTools> | null = null;
let cachedOrchestratorAgent: ToolLoopAgent<OrchestratorTools> | null = null;

function createAssistantConfig(): ToolLoopAgentSettings<never, AssistantTools> {
  const { model } = getModelForRole("chat");
  return {
    model: model as AgentModel,
    tools: assistantTools,
    instructions: assistantInstructions,
    stopWhen: assistantStopWhen,
    prepareStep: assistantPrepareStep,
  };
}

function createOrchestratorConfig(): ToolLoopAgentSettings<
  never,
  OrchestratorTools
> {
  const { model } = getModelForRole("orchestrator");
  return {
    model: model as AgentModel,
    tools: orchestratorTools,
    instructions: orchestratorInstructions,
    stopWhen: orchestratorStopWhen,
    prepareStep: orchestratorPrepareStep,
  };
}

// Lazy defaults - model is a getter to defer OpenAI client initialization
function createAssistantDefaults(): ToolLoopAgentSettings<
  never,
  AssistantTools
> {
  return {
    get model() {
      return getModelForRole("chat").model;
    },
    tools: assistantTools,
    instructions: assistantInstructions,
    stopWhen: assistantStopWhen,
    prepareStep: assistantPrepareStep,
  };
}

function createVoiceDefaults(): ToolLoopAgentSettings<never, AssistantTools> {
  return {
    get model() {
      return getModelForRole("voice").model;
    },
    tools: assistantTools,
    instructions: assistantInstructions,
    stopWhen: assistantStopWhen,
    prepareStep: assistantPrepareStep,
  };
}

function createOrchestratorDefaults(): ToolLoopAgentSettings<
  never,
  OrchestratorTools
> {
  return {
    get model() {
      return getModelForRole("orchestrator").model;
    },
    tools: orchestratorTools,
    instructions: orchestratorInstructions,
    stopWhen: orchestratorStopWhen,
    prepareStep: orchestratorPrepareStep,
  };
}

/**
 * Get the assistant agent (lazy-initialized).
 * Defers OpenAI client creation until first access, after .env is loaded.
 */
export function getAssistantAgent(): ToolLoopAgent<AssistantTools> {
  if (!cachedAssistantAgent) {
    cachedAssistantAgent = new ToolLoopAgent(createAssistantConfig());
  }
  return cachedAssistantAgent;
}

/**
 * Get the orchestrator agent (lazy-initialized).
 * Defers OpenAI client creation until first access, after .env is loaded.
 */
export function getOrchestratorAgent(): ToolLoopAgent<OrchestratorTools> {
  if (!cachedOrchestratorAgent) {
    cachedOrchestratorAgent = new ToolLoopAgent(createOrchestratorConfig());
  }
  return cachedOrchestratorAgent;
}

// Backward-compatible exports using getter pattern
// These defer initialization until property access
export const assistantAgent = {
  get stream() {
    return getAssistantAgent().stream.bind(getAssistantAgent());
  },
  get tools() {
    return getAssistantAgent().tools;
  },
} as ToolLoopAgent<AssistantTools>;

export const orchestratorAgent = {
  get stream() {
    return getOrchestratorAgent().stream.bind(getOrchestratorAgent());
  },
  get tools() {
    return getOrchestratorAgent().tools;
  },
} as ToolLoopAgent<OrchestratorTools>;

export function getAssistantAgentDefaults(): ToolLoopAgentSettings<
  never,
  AssistantTools
> {
  return createAssistantDefaults();
}

export function getVoiceAgentDefaults(): ToolLoopAgentSettings<
  never,
  AssistantTools
> {
  return createVoiceDefaults();
}

export function getOrchestratorAgentDefaults(): ToolLoopAgentSettings<
  never,
  OrchestratorTools
> {
  return createOrchestratorDefaults();
}

// Type inference using the actual agent types
export type AssistantUIMessage = InferAgentUIMessage<
  ToolLoopAgent<AssistantTools>
>;
export type OrchestratorUIMessage = InferAgentUIMessage<
  ToolLoopAgent<OrchestratorTools>
>;

// Expose constants for downstream tuning/testing when required.
export const ASSISTANT_AGENT_MAX_STEPS = ASSISTANT_MAX_STEPS;
export const ORCHESTRATOR_AGENT_MAX_STEPS = ORCHESTRATOR_MAX_STEPS;
