import {
  type LinearActivityParams,
  type LinearActivityType,
  emitLinearActivity as originalEmitLinearActivity,
} from "../orchestrator/linear";

export {
  extractIssueIdFromSession,
  type LinearActivityParams,
  type LinearActivityType,
  setLinearDelegate,
  setLinearSessionExternalUrl,
  setLinearStarted,
  setLinearCompleted,
  setLinearCancelled,
  commentOnLinearIssue,
} from "../orchestrator/linear";

export { configureLinearMetrics } from "../orchestrator/linearmetrics";

export async function emitLinearActivity(
  type: LinearActivityType,
  params: LinearActivityParams
): Promise<{ ok: boolean; id?: string }> {
  return originalEmitLinearActivity(type, params);
}
