import { randomUUID } from "node:crypto";

export type VoiceSessionSurface = "drive" | "carplay" | "web" | "native" | "stream" | "unknown";
export type VoiceSessionMode = "clip" | "stream";
export type VoiceSessionStatus = "idle" | "recording" | "processing" | "responding" | "error";

export interface VoiceSessionSnapshot {
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
}

type MutableSession = VoiceSessionSnapshot;

const sessions = new Map<string, MutableSession>();
const sessionsByUser = new Map<string, Set<string>>();

const knownSurfaces: VoiceSessionSurface[] = ["drive", "carplay", "web", "native", "stream", "unknown"];

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

function attachUserSession(userId: string, sessionId: string) {
  if (!sessionsByUser.has(userId)) {
    sessionsByUser.set(userId, new Set());
  }
  sessionsByUser.get(userId)!.add(sessionId);
}

function detachUserSession(userId: string, sessionId: string) {
  const set = sessionsByUser.get(userId);
  if (!set) {
    return;
  }
  set.delete(sessionId);
  if (set.size === 0) {
    sessionsByUser.delete(userId);
  }
}

function now() {
  return Date.now();
}

function clone(record: MutableSession): VoiceSessionSnapshot {
  return { ...record };
}

export function claimVoiceSession(params: {
  userId: string;
  sessionId?: string;
  surface?: string | null;
  mode: VoiceSessionMode;
  thread?: string;
  resource?: string;
  codec?: { input?: string; output?: string };
}): VoiceSessionSnapshot {
  const surface = normalizeSurface(params.surface);
  const sessionId = params.sessionId ?? randomUUID();
  const existing = sessions.get(sessionId);
  if (existing && existing.userId !== params.userId) {
    throw new Error("voice_session_conflict");
  }

  const timestamp = now();
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

  sessions.set(sessionId, record);
  attachUserSession(params.userId, sessionId);
  return clone(record);
}

export function updateVoiceSession(
  sessionId: string,
  patch: Partial<Omit<VoiceSessionSnapshot, "id" | "userId" | "createdAt">>
): VoiceSessionSnapshot | null {
  const existing = sessions.get(sessionId);
  if (!existing) {
    return null;
  }
  const updated: MutableSession = {
    ...existing,
    ...patch,
    status: (patch.status ?? existing.status) as VoiceSessionStatus,
    updatedAt: now(),
  };
  sessions.set(sessionId, updated);
  return clone(updated);
}

export function completeVoiceSession(
  sessionId: string,
  patch?: Partial<Omit<VoiceSessionSnapshot, "id" | "userId" | "createdAt">>
): VoiceSessionSnapshot | null {
  const existing = sessions.get(sessionId);
  if (!existing) {
    return null;
  }
  const updated: MutableSession = {
    ...existing,
    ...patch,
    status: "idle",
    updatedAt: now(),
  };
  sessions.set(sessionId, updated);
  return clone(updated);
}

export function markVoiceSessionError(sessionId: string, message: string) {
  updateVoiceSession(sessionId, {
    status: "error",
    lastError: message,
  });
}

export function releaseVoiceSession(sessionId: string) {
  const existing = sessions.get(sessionId);
  if (!existing) {
    return;
  }
  sessions.delete(sessionId);
  detachUserSession(existing.userId, sessionId);
}

export function listVoiceSessions(userId: string): VoiceSessionSnapshot[] {
  const ids = sessionsByUser.get(userId);
  if (!ids) {
    return [];
  }
  const snapshots: VoiceSessionSnapshot[] = [];
  for (const id of ids.values()) {
    const record = sessions.get(id);
    if (record) {
      snapshots.push(clone(record));
    }
  }
  return snapshots.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getVoiceSession(sessionId: string): VoiceSessionSnapshot | null {
  const record = sessions.get(sessionId);
  return record ? clone(record) : null;
}
