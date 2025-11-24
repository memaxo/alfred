import { auth } from "@alfred/auth";
import * as policyRepo from "@alfred/db/repo/policy";
import { logger } from "@alfred/logger";
import {
  type EvaluateInput,
  evaluate,
  type PolicyResource,
} from "@alfred/policy";
import {
  type VoiceSocketData,
  VoiceSocketHandler,
} from "@alfred/voice/server/socket";
import { createContext } from "../context";
import { policyDecisionsTotal, policyObligationsTotal } from "../metrics";
import {
  getSessionUser,
  getSessionUserId,
  getSessionUserRoles,
  getSessionUserScopes,
} from "../utils/session";
import { runAssistantForVoice } from "./assistant";
import { getVoicePools } from "./pools";
import {
  claimVoiceSession,
  completeVoiceSession,
  markVoiceSessionError,
  updateVoiceSession,
  type VoiceSessionStatus,
} from "./session-registry";

const DEFAULT_PORT = 8788;
const INACTIVITY_TIMEOUT_MS = 30_000;
const CLEANUP_INTERVAL_MS = 10_000;

let server: ReturnType<typeof Bun.serve> | null = null;
const activeSockets = new Set<any>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const STREAM_RESOURCE: PolicyResource = {
  kind: "voice.model",
  id: "local-streaming",
};
const REQUIRED_ACTIONS = ["voice.stt", "voice.tts"] as const;

export class VoiceStreamAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "VoiceStreamAuthError";
    this.status = status;
  }
}

async function evaluateVoicePolicy(
  session: any,
  action: (typeof REQUIRED_ACTIONS)[number],
  resource: PolicyResource
) {
  const sessionUser = getSessionUser(session);
  const subjectId = getSessionUserId(sessionUser);
  const subjectRoles = getSessionUserRoles(sessionUser);
  const subjectScopes = getSessionUserScopes(sessionUser) ?? undefined;

  const evaluation: EvaluateInput = {
    subject: {
      id: subjectId,
      roles: subjectRoles,
      scopes: subjectScopes,
    },
    action,
    resource,
  };

  const decision = await evaluate(evaluation);
  await policyRepo.createAuditLog({
    userId: subjectId,
    action,
    resource,
    decision: decision.allow ? "allow" : "deny",
    traceId: null,
    obligations: decision.obligations,
    context: null,
  });
  policyDecisionsTotal.labels(action, decision.allow ? "allow" : "deny").inc();
  if (decision.obligations && decision.obligations.length > 0) {
    for (const obligation of decision.obligations) {
      policyObligationsTotal.labels(action, String(obligation)).inc();
    }
  }

  if (!decision.allow) {
    throw new VoiceStreamAuthError(
      decision.reason ?? "voice_stream_forbidden",
      403
    );
  }
}

export async function authorizeVoiceStreamRequest(req: Request) {
  let session: any | null = null;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch {
    session = null;
  }
  if (!session) {
    throw new VoiceStreamAuthError("session_required", 401);
  }
  const sessionUser = getSessionUser(session);
  if (!sessionUser?.id) {
    throw new VoiceStreamAuthError("session_required", 401);
  }
  for (const action of REQUIRED_ACTIONS) {
    await evaluateVoicePolicy(session, action, STREAM_RESOURCE);
  }
  return {
    userId: sessionUser.id,
  };
}

export function startVoiceStreamingPrototype(): void {
  if (server || process.env.VOICE_STREAMING_PROTO !== "1") {
    return;
  }
  if ((process.env.VOICE_PROVIDER ?? "maya1") !== "maya1") {
    logger.warn("voice_stream_proto_disabled", {
      reason: "maya1_provider_required",
    });
    return;
  }

  const { voiceRegistry } = getVoicePools();

  const handler = new VoiceSocketHandler(voiceRegistry, {
    onSessionStart: async (userId, sessionId, config) => {
      const session = await claimVoiceSession({
        userId,
        sessionId,
        surface: config.surface,
        mode: "stream",
        codec: {
          input: config.codec,
          output: config.ttsFormat,
        },
      });
      await updateVoiceSession(session.id, { status: "recording" });
      return session.id;
    },
    onSessionStatus: async (registryId, status) => {
      const statusMap: Record<string, VoiceSessionStatus> = {
        recording: "recording",
        processing: "processing",
        playing: "responding",
        idle: "idle",
      };
      await updateVoiceSession(registryId, {
        status: statusMap[status] as VoiceSessionStatus,
      });
    },
    onTranscriptUpdate: async (registryId, text) => {
      await updateVoiceSession(registryId, { lastTranscript: text });
    },
    onAssistantResponse: async (registryId, text) => {
      await updateVoiceSession(registryId, { lastAssistantText: text });
    },
    onSessionError: async (registryId, error) => {
      await markVoiceSessionError(registryId, error);
    },
    onSessionComplete: async (registryId) => {
      await completeVoiceSession(registryId);
    },
    runAssistant: async (userId, text, runtime) => {
      const result = await runAssistantForVoice(runtime as any, {
        text,
        userId,
        thread: undefined,
        resource: undefined,
      });
      return {
        text: result.text,
        replayId: result.replayId,
        raw: result.raw,
        durationSeconds: result.durationSeconds,
      };
    },
  });

  const port = Number(process.env.VOICE_STREAMING_PORT ?? DEFAULT_PORT);

  server = Bun.serve<VoiceSocketData>({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/voice/stream") {
        try {
          const [authz, ctx] = await Promise.all([
            authorizeVoiceStreamRequest(req),
            createContext({ req }),
          ]);
          const upgraded = server.upgrade(req, {
            data: {
              userId: authz.userId,
              runtime: ctx.runtimeContext,
              lastActivity: Date.now(),
            },
          });
          if (!upgraded) {
            return new Response("upgrade_failed", { status: 500 });
          }
          return;
        } catch (error) {
          if (error instanceof VoiceStreamAuthError) {
            logger.warn("voice_stream_proto_auth_failed", {
              status: error.status,
              message: error.message,
            });
            return new Response(error.message, { status: error.status });
          }
          logger.error("voice_stream_proto_upgrade_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response("voice_stream_error", { status: 500 });
        }
      }
      return new Response("voice streaming prototype", { status: 200 });
    },
    websocket: {
      open(ws) {
        // Init default data
        if (!ws.data.surface) {
          ws.data.surface = "stream";
        }
        ws.data.lastActivity = Date.now();
        activeSockets.add(ws);

        // Send ready
        try {
          ws.send(JSON.stringify({ type: "ready", sessionId: null }));
        } catch {}
      },
      async message(ws, message) {
        ws.data.lastActivity = Date.now();
        await handler.handleMessage(ws, message);
      },
      close(ws) {
        activeSockets.delete(ws);
        if (ws.data.sessionId) {
          voiceRegistry.removeSession(ws.data.sessionId);
        }
      },
    },
  });

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const ws of activeSockets) {
      if (now - ws.data.lastActivity > INACTIVITY_TIMEOUT_MS) {
        logger.info("voice_stream_proto_timeout", {
          sessionId: ws.data.sessionId,
        });
        ws.close(1000, "inactivity_timeout");
        activeSockets.delete(ws);
        if (ws.data.sessionId) {
          voiceRegistry.removeSession(ws.data.sessionId);
        }
      }
    }
  }, CLEANUP_INTERVAL_MS);

  logger.info("voice_stream_proto_listening", {
    port,
  });
}

export function stopVoiceStreamingPrototype(): void {
  if (!server) {
    return;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  try {
    server.stop(true);
  } catch (error) {
    logger.error("voice_stream_proto_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  server = null;
  activeSockets.clear();
}
