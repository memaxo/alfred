/**
 * Voice Control Tools
 * Exposes voice session status and control capabilities as agent tools
 */

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";

import { recordAssistantToolCall } from "../../../src/metrics";

// Dynamic imports to avoid bundling issues
const sessionRegistryPkg = "@alfred/api/voice/session-registry";

/**
 * Type for voice session snapshot
 *
 * Type duplicated locally to avoid bundling @alfred/api in client builds.
 * Must match VoiceSessionSnapshot from @alfred/api/voice/session-registry.
 * Note: consider extracting to @alfred/type if this becomes shared across packages.
 */
type VoiceSessionSnapshot = {
  id: string;
  userId: string;
  surface: string;
  mode: string;
  status: "idle" | "recording" | "processing" | "responding" | "error";
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

// ============================================================================
// voice_status Tool
// ============================================================================

const voiceStatusInputSchema = z.object({
  userId: z.string().min(1).describe("User ID for authorization"),
  sessionId: z
    .string()
    .optional()
    .describe("Specific session ID (optional, returns all if omitted)"),
  authz: z.string().optional().describe("Authorization token"),
});

const voiceStatusOutputSchema = z.object({
  sessions: z.array(
    z.object({
      sessionId: z.string(),
      status: z.enum([
        "idle",
        "recording",
        "processing",
        "responding",
        "error",
      ]),
      surface: z.string().optional(),
      mode: z.enum(["clip", "stream"]).optional(),
      startedAt: z.string(),
      lastTranscript: z.string().optional(),
    })
  ),
});

type VoiceStatusInput = z.infer<typeof voiceStatusInputSchema>;
type VoiceStatusOutput = z.infer<typeof voiceStatusOutputSchema>;

async function enforceVoiceStatusPolicy(
  input: VoiceStatusInput
): Promise<void> {
  await requireToolScopesAndPolicy(input.authz, ["voice.read"], {
    action: "voice.read",
    resource: {
      kind: "voice",
      id: input.sessionId ?? input.userId,
    },
  });
}

async function executeVoiceStatus(
  input: VoiceStatusInput
): Promise<VoiceStatusOutput> {
  const sessionRegistry = await import(/* @vite-ignore */ sessionRegistryPkg);
  const { getVoiceSession, listVoiceSessions } = sessionRegistry;

  let sessions: Awaited<ReturnType<typeof listVoiceSessions>>;

  if (input.sessionId) {
    const session = await getVoiceSession(input.sessionId);
    sessions = session ? [session] : [];
  } else {
    sessions = await listVoiceSessions(input.userId);
  }

  return {
    sessions: sessions.map((session: VoiceSessionSnapshot) => ({
      sessionId: session.id,
      status: session.status,
      surface: session.surface,
      mode: session.mode,
      startedAt: new Date(session.createdAt).toISOString(),
      lastTranscript: session.lastTranscript,
    })),
  };
}

export const toolVoiceStatus = {
  name: "voice_status",
  description:
    "Query the status of active voice sessions. Returns session metadata including status, surface, mode, and last transcript.",
  inputSchema: voiceStatusInputSchema,
  outputSchema: voiceStatusOutputSchema,
  execute: async ({ input }: { input: VoiceStatusInput }) => {
    recordAssistantToolCall("voice_status");
    await enforceVoiceStatusPolicy(input);
    return executeVoiceStatus(input);
  },
};

export type ToolVoiceStatus = typeof toolVoiceStatus;

// ============================================================================
// voice_control Tool
// ============================================================================

const voiceControlInputSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1).describe("Session ID to control"),
  action: z.enum(["pause", "resume", "interrupt", "stop"]),
  authz: z.string().optional(),
});

const voiceControlOutputSchema = z.object({
  success: z.boolean(),
  sessionId: z.string(),
  action: z.string(),
  newStatus: z.string().optional(),
});

type VoiceControlInput = z.infer<typeof voiceControlInputSchema>;
type VoiceControlOutput = z.infer<typeof voiceControlOutputSchema>;

async function enforceVoiceControlPolicy(
  input: VoiceControlInput
): Promise<void> {
  await requireToolScopesAndPolicy(input.authz, ["voice.write"], {
    action: "voice.control",
    resource: {
      kind: "voice",
      id: input.sessionId,
    },
  });
}

/**
 * Handle pause action: set session status to idle
 */
async function handlePauseAction(
  sessionId: string,
  updateVoiceSession: (
    id: string,
    patch: { status: "idle" }
  ) => Promise<VoiceSessionSnapshot | null>
): Promise<string | undefined> {
  const updated = await updateVoiceSession(sessionId, {
    status: "idle",
  });
  return updated?.status;
}

/**
 * Handle resume action: set session status to recording
 */
async function handleResumeAction(
  sessionId: string,
  updateVoiceSession: (
    id: string,
    patch: { status: "recording" }
  ) => Promise<VoiceSessionSnapshot | null>
): Promise<string | undefined> {
  const updated = await updateVoiceSession(sessionId, {
    status: "recording",
  });
  return updated?.status;
}

/**
 * Handle interrupt action: set to idle and clear transcript
 */
async function handleInterruptAction(
  sessionId: string,
  updateVoiceSession: (
    id: string,
    patch: { status: "idle"; lastTranscript?: undefined }
  ) => Promise<VoiceSessionSnapshot | null>
): Promise<string | undefined> {
  const updated = await updateVoiceSession(sessionId, {
    status: "idle",
    lastTranscript: undefined,
  });
  return updated?.status;
}

/**
 * Handle stop action: set to idle (deactivation handled by registry cleanup)
 */
async function handleStopAction(
  sessionId: string,
  updateVoiceSession: (
    id: string,
    patch: { status: "idle" }
  ) => Promise<VoiceSessionSnapshot | null>
): Promise<string | undefined> {
  const updated = await updateVoiceSession(sessionId, {
    status: "idle",
  });
  return updated?.status;
}

async function executeVoiceControl(
  input: VoiceControlInput
): Promise<VoiceControlOutput> {
  const sessionRegistry = await import(/* @vite-ignore */ sessionRegistryPkg);
  const { getVoiceSession, updateVoiceSession } = sessionRegistry;

  const session = await getVoiceSession(input.sessionId);
  if (!session) {
    throw new Error(
      `voice_session_not_found: session ${input.sessionId} does not exist`
    );
  }

  // Verify user owns the session
  if (session.userId !== input.userId) {
    throw new Error(
      `voice_session_unauthorized: user ${input.userId} does not own session ${input.sessionId}`
    );
  }

  let newStatus: string | undefined;

  switch (input.action) {
    case "pause":
      newStatus = await handlePauseAction(input.sessionId, updateVoiceSession);
      break;
    case "resume":
      newStatus = await handleResumeAction(input.sessionId, updateVoiceSession);
      break;
    case "interrupt":
      newStatus = await handleInterruptAction(
        input.sessionId,
        updateVoiceSession
      );
      break;
    case "stop":
      newStatus = await handleStopAction(input.sessionId, updateVoiceSession);
      break;
    default:
      throw new Error(
        `voice_control_invalid_action: unknown action "${input.action}"`
      );
  }

  return {
    success: true,
    sessionId: input.sessionId,
    action: input.action,
    newStatus,
  };
}

export const toolVoiceControl = {
  name: "voice_control",
  description:
    "Control voice playback and handle interruptions. Actions: pause (set to idle), resume (set to recording), interrupt (clear transcript and set to idle), stop (deactivate session).",
  inputSchema: voiceControlInputSchema,
  outputSchema: voiceControlOutputSchema,
  execute: async ({ input }: { input: VoiceControlInput }) => {
    recordAssistantToolCall("voice_control");
    await enforceVoiceControlPolicy(input);
    return executeVoiceControl(input);
  },
};

export type ToolVoiceControl = typeof toolVoiceControl;
