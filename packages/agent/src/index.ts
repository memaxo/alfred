import { mastra, orchestratorAgent, planWorkflow, assistantAgent } from "./mastra";
import { toolDroid } from "./orchestrator/tool/droid";
import { toolDocker } from "./orchestrator/tool/docker";
import { toolRouter } from "./orchestrator/tool/router";
import {
  registerDroidExecCounter,
  registerDroidExecHistogram,
  registerEvalRunsCounter,
  registerEvalDurationHistogram,
  registerEvalScoreCounter,
  registerEvalFailureCounter,
  registerLaminarDatapointCounter,
  registerLaminarErrorCounter,
  registerAssistantToolCounter,
  registerAssistantEscalationCounter,
  registerMemoryUpdatesCounter,
  registerMemoryForgetsCounter,
  recordMemoryUpdate,
  recordMemoryForget,
} from "./metrics";
import { initializeLaminar } from "./eval/laminar-bridge";
import { runEval } from "./eval/runner";

void initializeLaminar();

export {
  mastra,
  orchestratorAgent,
  assistantAgent,
  planWorkflow,
  toolDroid,
  toolDocker,
  toolRouter,
  runEval,
};
export {
  registerDroidExecCounter,
  registerDroidExecHistogram,
  registerEvalRunsCounter,
  registerEvalDurationHistogram,
  registerEvalScoreCounter,
  registerEvalFailureCounter,
  registerLaminarDatapointCounter,
  registerLaminarErrorCounter,
  registerAssistantToolCounter,
  registerAssistantEscalationCounter,
  registerMemoryUpdatesCounter,
  registerMemoryForgetsCounter,
  recordMemoryUpdate,
  recordMemoryForget,
};
