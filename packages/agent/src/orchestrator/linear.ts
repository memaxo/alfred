// Minimal, dependency-free stubs to avoid cross-package coupling in agent.
// Full Linear integration lives in the API layer and DB repos.

export type LinearActivityType = "thought" | "action" | "response" | "error";

export type LinearActivityParams = {
  sessionId: string;
  space: string;
  authz: string;
  title?: string;
  body?: string;
  parameter?: string;
  result?: string;
  ephemeral?: boolean;
};

export type LinearSessionParams = {
  space: string;
  issueId: string;
  authz: string;
  delegateId?: string;
};

export async function emitLinearActivity(
  _type: LinearActivityType,
  _params: LinearActivityParams
): Promise<{ ok: boolean; id?: string }> {
  // No-op in agent package; API implements real behavior.
  return { ok: false };
}

export async function setLinearDelegate(_params: LinearSessionParams): Promise<void> {
  // No-op stub
}

export async function setLinearStarted(
  _params: LinearSessionParams
): Promise<{ stateId: string }> {
  // No-op stub: return a placeholder state id
  return { stateId: "state_stub" };
}

export async function setLinearSessionExternalUrl(
  _sessionId: string,
  _space: string,
  _authz: string,
  _url: string
): Promise<void> {
  // No-op stub
}

export function extractIssueIdFromSession(sessionId: string): string | null {
  return sessionId && sessionId.length > 0 ? sessionId : null;
}
