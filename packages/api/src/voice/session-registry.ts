import { randomUUID } from "node:crypto";
import { getRedis } from "@alfred/auth/redis";

export type VoiceSessionSurface =
  | "drive"
  | "carplay"
  | "web"
  | "native"
  | "stream"
  | "unknown";
export type VoiceSessionMode = "clip" | "stream";
export type VoiceSessionStatus =
  | "idle"
  | "recording"
  | "processing"
  | "responding"
  | "error";

export type VoiceSessionSnapshot = {
  id: string;
  userId: string;
  surface: VoiceSessionSurface;
  mode: VoiceSessionMode;
  status: VoiceSessionStatus;
  createdAt: number;
  updatedAt: number;
  thread?: string;
  resource?: string;
  codec?: {
    input?: string;
    output?: string;
  };
  lastTranscript?: string;
  lastAssistantText?: string;
  lastError?: string;
};

type MutableSession = VoiceSessionSnapshot;

const SESSION_TTL_SECONDS = 3600; // 1 hour

// In-memory fallback
const memSessions = new Map<string, MutableSession>();
const memSessionsByUser = new Map<string, Set<string>>();

const knownSurfaces: VoiceSessionSurface[] = [
  "drive",
  "carplay",
  "web",
  "native",
  "stream",
  "unknown",
];

function normalizeSurface(surface?: string | null): VoiceSessionSurface {
  if (!surface) {
    return "unknown";
  }
  const normalized = surface.toLowerCase();
  if (knownSurfaces.includes(normalized as VoiceSessionSurface)) {
    return normalized as VoiceSessionSurface;
  }
  return "unknown";
}

function now() {
  return Date.now();
}

function clone(record: MutableSession): VoiceSessionSnapshot {
  return { ...record };
}

// Redis keys
const keySession = (id: string) => `voice:session:${id}`;
const keyUserSessions = (userId: string) => `voice:user:${userId}:sessions`;

export async function claimVoiceSession(params: {
  userId: string;
  sessionId?: string;
  surface?: string | null;
  mode: VoiceSessionMode;
  thread?: string;
  resource?: string;
  codec?: { input?: string; output?: string };
}): Promise<VoiceSessionSnapshot> {
  const redis = getRedis();
  const surface = normalizeSurface(params.surface);
  const sessionId = params.sessionId ?? randomUUID();

  const timestamp = now();

  if (redis) {
    const existingJson = await redis.get(keySession(sessionId));
    let record: MutableSession;

    if (existingJson) {
      const existing = JSON.parse(existingJson) as MutableSession;
      if (existing.userId !== params.userId) {
        throw new Error("voice_session_conflict");
      }
      record = {
        ...existing,
        surface,
        mode: params.mode,
        thread: params.thread ?? existing.thread,
        resource: params.resource ?? existing.resource,
        codec: params.codec ?? existing.codec,
        updatedAt: timestamp,
      };
    } else {
      record = {
        id: sessionId,
        userId: params.userId,
        surface,
        mode: params.mode,
        status: "idle",
        createdAt: timestamp,
        updatedAt: timestamp,
        thread: params.thread,
        resource: params.resource,
        codec: params.codec,
      };
    }

    await redis.set(
      keySession(sessionId),
      JSON.stringify(record),
      "EX",
      SESSION_TTL_SECONDS
    );
    await redis.sadd(keyUserSessions(params.userId), sessionId);
    await redis.expire(keyUserSessions(params.userId), SESSION_TTL_SECONDS);

    return record;
  }
  // In-memory fallback
  const existing = memSessions.get(sessionId);
  if (existing && existing.userId !== params.userId) {
    throw new Error("voice_session_conflict");
  }

  const record: MutableSession = existing
    ? {
        ...existing,
        surface,
        mode: params.mode,
        thread: params.thread ?? existing.thread,
        resource: params.resource ?? existing.resource,
        codec: params.codec ?? existing.codec,
        updatedAt: timestamp,
      }
    : {
        id: sessionId,
        userId: params.userId,
        surface,
        mode: params.mode,
        status: "idle",
        createdAt: timestamp,
        updatedAt: timestamp,
        thread: params.thread,
        resource: params.resource,
        codec: params.codec,
      };

  memSessions.set(sessionId, record);
  if (!memSessionsByUser.has(params.userId)) {
    memSessionsByUser.set(params.userId, new Set());
  }
  memSessionsByUser.get(params.userId)?.add(sessionId);
  return clone(record);
}

export async function updateVoiceSession(
  sessionId: string,
  patch: Partial<Omit<VoiceSessionSnapshot, "id" | "userId" | "createdAt">>
): Promise<VoiceSessionSnapshot | null> {
  const redis = getRedis();
  if (redis) {
    const existingJson = await redis.get(keySession(sessionId));
    if (!existingJson) {
      return null;
    }

    const existing = JSON.parse(existingJson) as MutableSession;
    const updated: MutableSession = {
      ...existing,
      ...patch,
      status: (patch.status ?? existing.status) as VoiceSessionStatus,
      updatedAt: now(),
    };
    await redis.set(
      keySession(sessionId),
      JSON.stringify(updated),
      "EX",
      SESSION_TTL_SECONDS
    );
    return updated;
  }
  const existing = memSessions.get(sessionId);
  if (!existing) {
    return null;
  }
  const updated: MutableSession = {
    ...existing,
    ...patch,
    status: (patch.status ?? existing.status) as VoiceSessionStatus,
    updatedAt: now(),
  };
  memSessions.set(sessionId, updated);
  return clone(updated);
}

export async function completeVoiceSession(
  sessionId: string,
  patch?: Partial<Omit<VoiceSessionSnapshot, "id" | "userId" | "createdAt">>
): Promise<VoiceSessionSnapshot | null> {
  return updateVoiceSession(sessionId, { ...patch, status: "idle" });
}

export async function markVoiceSessionError(
  sessionId: string,
  message: string
) {
  await updateVoiceSession(sessionId, {
    status: "error",
    lastError: message,
  });
}

export async function releaseVoiceSession(sessionId: string) {
  const redis = getRedis();
  if (redis) {
    const existingJson = await redis.get(keySession(sessionId));
    if (existingJson) {
      const existing = JSON.parse(existingJson) as MutableSession;
      await redis.del(keySession(sessionId));
      await redis.srem(keyUserSessions(existing.userId), sessionId);
    }
  } else {
    const existing = memSessions.get(sessionId);
    if (!existing) {
      return;
    }
    memSessions.delete(sessionId);
    const set = memSessionsByUser.get(existing.userId);
    if (set) {
      set.delete(sessionId);
      if (set.size === 0) {
        memSessionsByUser.delete(existing.userId);
      }
    }
  }
}

export async function listVoiceSessions(
  userId: string
): Promise<VoiceSessionSnapshot[]> {
  const redis = getRedis();
  if (redis) {
    const ids = await redis.smembers(keyUserSessions(userId));
    if (!ids || ids.length === 0) {
      return [];
    }

    const snapshots: VoiceSessionSnapshot[] = [];
    const jsons = await Promise.all(ids.map((id) => redis.get(keySession(id))));

    for (const json of jsons) {
      if (json) {
        snapshots.push(JSON.parse(json));
      }
    }
    return snapshots.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const ids = memSessionsByUser.get(userId);
  if (!ids) {
    return [];
  }
  const snapshots: VoiceSessionSnapshot[] = [];
  for (const id of ids.values()) {
    const record = memSessions.get(id);
    if (record) {
      snapshots.push(clone(record));
    }
  }
  return snapshots.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getVoiceSession(
  sessionId: string
): Promise<VoiceSessionSnapshot | null> {
  const redis = getRedis();
  if (redis) {
    const json = await redis.get(keySession(sessionId));
    return json ? JSON.parse(json) : null;
  }
  const record = memSessions.get(sessionId);
  return record ? clone(record) : null;
}
