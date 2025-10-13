import { mastra, orchestratorAgent, planWorkflow } from "./mastra";
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
} from "./metrics";
import { initializeLaminar } from "./eval/laminar-bridge";
import { runEval } from "./eval/runner";

void initializeLaminar();

export { mastra, orchestratorAgent, planWorkflow, toolDroid, toolDocker, toolRouter, runEval };
export {
  registerDroidExecCounter,
  registerDroidExecHistogram,
  registerEvalRunsCounter,
  registerEvalDurationHistogram,
  registerEvalScoreCounter,
  registerEvalFailureCounter,
  registerLaminarDatapointCounter,
  registerLaminarErrorCounter,
};
