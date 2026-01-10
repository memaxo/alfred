import { executorServerRegistryTotal } from "./metrics.js";

export type ExecProfile = "default" | "server";

export function normalizeExecProfile(raw: unknown): ExecProfile {
  if (typeof raw !== "string") {
    return "default";
  }
  const v = raw.trim().toLowerCase();
  if (v === "server") {
    return "server";
  }
  return "default";
}

const AGENTFS_CONTAINER_PREFIX = "alfred-agentfs-";

function isAgentfsContainerName(raw: unknown): boolean {
  if (typeof raw !== "string") {
    return false;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.startsWith(AGENTFS_CONTAINER_PREFIX);
}

export function resolveExecProfile(
  execProfile: unknown,
  containerName: unknown
): ExecProfile {
  if (typeof execProfile === "string") {
    return normalizeExecProfile(execProfile);
  }
  return isAgentfsContainerName(containerName) ? "server" : "default";
}

export function isExecProfileStrict(): boolean {
  return process.env.ORCH_EXEC_PROFILE_STRICT?.trim() === "1";
}

function parseKey(
  key: string
): { executor: string; profile: ExecProfile } | null {
  if (!key.startsWith("agentfs:")) {
    return null;
  }
  const parts = key.split(":");
  if (parts.length < 4) {
    return null;
  }
  const executor = parts[2] ?? "unknown";
  const profile = normalizeExecProfile(parts[3]);
  return { executor, profile };
}

function recordOutcome(key: string, outcome: string): void {
  try {
    const parsed = parseKey(key);
    if (!parsed) {
      executorServerRegistryTotal.inc({
        executor: "unknown",
        profile: "default",
        outcome,
      });
      return;
    }
    executorServerRegistryTotal.inc({
      executor: parsed.executor,
      profile: parsed.profile,
      outcome,
    });
  } catch {
    // ignore metrics failures
  }
}

export function serverKey(args: {
  containerName: string;
  executor: string;
  profile: ExecProfile;
}): string {
  return `agentfs:${args.containerName}:${args.executor}:${args.profile}`;
}

export type ServerHandle = {
  stop: (reason?: string) => Promise<void> | void;
};

type ServerCheck = (handle: ServerHandle) => Promise<boolean> | boolean;

const handles = new Map<string, ServerHandle>();
const inflight = new Map<string, Promise<ServerHandle>>();

export async function ensureServer(args: {
  key: string;
  start: () => Promise<ServerHandle>;
  healthy?: ServerCheck;
}): Promise<ServerHandle> {
  const existing = handles.get(args.key);
  if (existing) {
    const ok = args.healthy ? await args.healthy(existing) : true;
    if (ok) {
      recordOutcome(args.key, "hit");
      return existing;
    }
    handles.delete(args.key);
    try {
      await existing.stop("unhealthy");
    } catch {
      // ignore stop failures during restart
    }
    recordOutcome(args.key, "restart");
  }

  const pending = inflight.get(args.key);
  if (pending) {
    recordOutcome(args.key, "wait");
    return pending;
  }

  const startPromise = (async () => {
    try {
      recordOutcome(args.key, "start");
      const next = await args.start();
      handles.set(args.key, next);
      return next;
    } finally {
      inflight.delete(args.key);
    }
  })();

  inflight.set(args.key, startPromise);
  return startPromise;
}

export async function stopServer(key: string, reason?: string): Promise<void> {
  const existing = handles.get(key);
  handles.delete(key);

  const pending = inflight.get(key);
  if (pending) {
    try {
      const started = await pending;
      handles.delete(key);
      await started.stop(reason ?? "stop");
      return;
    } catch {
      return;
    } finally {
      inflight.delete(key);
    }
  }

  if (!existing) {
    return;
  }
  try {
    await existing.stop(reason ?? "stop");
  } catch {
    // ignore best-effort stop
  }
}

export async function stopAllServers(reason?: string): Promise<void> {
  const pending = Array.from(inflight.values());
  if (pending.length > 0) {
    await Promise.allSettled(pending);
  }

  const entries = Array.from(handles.entries());
  handles.clear();
  inflight.clear();

  await Promise.allSettled(
    entries.map(async ([, handle]) => {
      try {
        await handle.stop(reason ?? "stopAll");
      } catch {
        // ignore
      }
    })
  );
}

export const __internals = {
  reset: () => {
    handles.clear();
    inflight.clear();
  },
  size: () => handles.size,
};
