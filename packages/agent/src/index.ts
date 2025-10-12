import { mastra, orchestratorAgent, planWorkflow } from "./mastra";
import { toolDroid } from "./orchestrator/tool/droid";
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

export { mastra, orchestratorAgent, planWorkflow, toolDroid, runEval };
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
