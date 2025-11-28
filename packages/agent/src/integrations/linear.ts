import {
  type LinearActivityParams,
  type LinearActivityType,
  emitLinearActivity as originalEmitLinearActivity,
} from "../orchestrator/linear";

export {
  commentOnLinearIssue,
  extractIssueIdFromSession,
  type LinearActivityParams,
  type LinearActivityType,
  setLinearCancelled,
  setLinearCompleted,
  setLinearDelegate,
  setLinearSessionExternalUrl,
  setLinearStarted,
} from "../orchestrator/linear";

export { configureLinearMetrics } from "../orchestrator/linearmetrics";

export async function emitLinearActivity(
  type: LinearActivityType,
  params: LinearActivityParams
): Promise<{ ok: boolean; id?: string }> {
  return originalEmitLinearActivity(type, params);
}
