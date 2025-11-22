import {
  emitLinearActivity as originalEmitLinearActivity,
  type LinearActivityParams,
  type LinearActivityType,
} from "../orchestrator/linear";

export {
  type LinearActivityParams,
  type LinearActivityType,
  setLinearDelegate,
  setLinearStarted,
  setLinearSessionExternalUrl,
  extractIssueIdFromSession,
} from "../orchestrator/linear";

export { configureLinearMetrics } from "../orchestrator/linearmetrics";

export async function emitLinearActivity(
  type: LinearActivityType,
  params: LinearActivityParams
): Promise<{ ok: boolean; id?: string }> {
  return originalEmitLinearActivity(type, params);
}

