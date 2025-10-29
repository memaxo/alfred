type PubSub = {
  subscribe: (topic: string, handler: (payload: unknown) => Promise<void> | void) => () => void;
};

type WorkflowCaller = {
  workflow: {
    resume: (input: { runId: string; event: "linear-authz"; authz: string }) => Promise<unknown>;
  };
};

interface LinearAgentActivity {
  type?: string;
  runId?: string;
  data?: unknown;
}

const AUTHZ_PATHS: Array<string[]> = [
  ["data", "authorization"],
  ["data", "authz"],
  ["data", "agentSession", "authorization"],
  ["data", "agentSession", "authorization", "token"],
  ["data", "agentSession", "authz"],
  ["data", "authorization", "value"],
  ["data", "authorization", "token"],
  ["data", "metadata", "authz"],
];

function isLinearAgentActivity(payload: unknown): payload is LinearAgentActivity {
  return !!payload && typeof payload === "object";
}

function extractAuthz(payload: LinearAgentActivity): string | null {
  const root = payload as Record<string, unknown>;

  for (const path of AUTHZ_PATHS) {
    let current: unknown = root;
    for (const segment of path) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current === "string" && current.trim().length > 0) {
      return current.trim();
    }
    if (current && typeof current === "object") {
      const token = (current as { token?: unknown }).token;
      if (typeof token === "string" && token.length > 0) {
        return token;
      }
      const value = (current as { value?: unknown }).value;
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }

  return null;
}

function shouldResume(event: LinearAgentActivity, authz: string | null): authz is string {
  if (typeof event.runId !== "string" || event.runId.length === 0) {
    return false;
  }

  return typeof authz === "string" && authz.length > 0;
}

export function subscribeLinearAgentActivity({
  pubsub,
  createCaller,
}: {
  pubsub: PubSub;
  createCaller: () => WorkflowCaller;
}): () => void {
  if (!pubsub || typeof pubsub.subscribe !== "function") {
    return () => {};
  }

  const handler = async (payload: unknown) => {
    if (!isLinearAgentActivity(payload)) {
      return;
    }
    const authz = extractAuthz(payload);
    if (!shouldResume(payload, authz)) {
      return;
    }

    const runId = payload.runId!;
    const caller = createCaller();
    try {
      await caller.workflow.resume({
        runId,
        event: "linear-authz",
        authz,
      });
    } catch (error) {
      console.error("[linear-subscriber] Failed to resume workflow:", error);
    }
  };

  return pubsub.subscribe("linear.agent_activity", handler);
}
