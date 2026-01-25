import type { VoiceStreamEvent } from "@alfred/type/voice";

import { logger } from "@alfred/logger";
import { markVoice } from "@alfred/metrics/performance";
import {
  voiceStreamEventsTotal,
  voiceStreamLatencySeconds,
} from "@alfred/voice/metrics";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { getVoicePools } from "../voice/pools";
import {
  getVoiceSession,
  listVoiceSessions,
  releaseVoiceSession,
} from "../voice/session-registry";
import { getVoiceIceServers, isVoiceWebrtcEnabled } from "../voice/webrtc";
import {
  addWebrtcIceCandidate,
  applyWebrtcOffer,
  closeWebrtcSession,
  createWebrtcSession,
  drainWebrtcIceCandidates,
  getWebrtcSession,
} from "../voice/webrtcsession";
import {
  voiceDownloadModelProcedure,
  voiceListAvailableModelsProcedure,
  voiceListVoicesProcedure,
} from "./voice/model";
import { voiceSpeechToSpeechProcedure } from "./voice/s2s";
import {
  toWebrtcResource,
  voiceSessionStatusInput,
  voiceStreamInput,
  webrtcCreateInput,
  webrtcIceInput,
  webrtcOfferInput,
  webrtcSessionInput,
} from "./voice/schema";
import {
  voiceSttClearCacheProcedure,
  voiceSttReleaseSessionProcedure,
  voiceSttSessionInfoProcedure,
  voiceSttTranscribeProcedure,
  voiceSttTranscribeStreamingProcedure,
} from "./voice/stt";
import {
  voicePreviewVoiceProcedure,
  voiceTtsSynthesizeProcedure,
} from "./voice/tts";

export const voiceRouter = router({
  sttTranscribe: voiceSttTranscribeProcedure,

  /**
   * Streaming transcription with cache-aware session affinity.
   *
   * Use this for real-time voice input where you want:
   * - Lower latency via incremental processing
   * - Session state maintained across audio chunks
   * - Partial results as audio streams in
   *
   * The sessionId ensures requests route to the same worker process,
   * enabling Nemotron's cache-aware streaming mode.
   */
  sttTranscribeStreaming: voiceSttTranscribeStreamingProcedure,

  /**
   * Clear the streaming cache for a session.
   * Call this when starting a new utterance to reset decoder state.
   */
  sttClearCache: voiceSttClearCacheProcedure,

  /**
   * Release session affinity for a streaming session.
   * Call this when a voice session ends to free up resources.
   */
  sttReleaseSession: voiceSttReleaseSessionProcedure,

  /**
   * Get streaming session info for debugging/monitoring.
   */
  sttSessionInfo: voiceSttSessionInfoProcedure,

  ttsSynthesize: voiceTtsSynthesizeProcedure,

  speechToSpeech: voiceSpeechToSpeechProcedure,

  listAvailableModels: voiceListAvailableModelsProcedure,

  downloadModel: voiceDownloadModelProcedure,

  listVoices: voiceListVoicesProcedure,

  previewVoice: voicePreviewVoiceProcedure,

  sessions: authedProcedure
    .input(voiceSessionStatusInput)
    .query(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      if (input?.sessionId) {
        const snapshot = await getVoiceSession(input.sessionId);
        if (!snapshot || snapshot.userId !== session.user.id) {
          return [];
        }
        return [snapshot];
      }
      return listVoiceSessions(session.user.id);
    }),

  endSession: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const snapshot = await getVoiceSession(input.sessionId);
      if (snapshot && snapshot.userId === session.user.id) {
        await releaseVoiceSession(input.sessionId);
      }
    }),

  /**
   * Voice pipeline health check.
   *
   * Returns the health status of STT and TTS pools, and optionally
   * runs a quick roundtrip test to verify the full pipeline works.
   */
  health: authedProcedure
    .input(
      z
        .object({
          runRoundtrip: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ input }) => {
      try {
        const { checkVoiceHealth } = await import("../services/voice");
        return await checkVoiceHealth({ runRoundtrip: input?.runRoundtrip });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "voice_health_check_failed",
          cause: error,
        });
      }
    }),

  webrtcCreate: authedProcedure
    .use(requirePolicy("voice.stt", toWebrtcResource))
    .use(requirePolicy("voice.tts", toWebrtcResource))
    .input(webrtcCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      if (!isVoiceWebrtcEnabled()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "voice_webrtc_disabled",
        });
      }

      const sessionId = input.sessionId ?? randomUUID();
      const existing = getWebrtcSession(sessionId);
      if (existing && existing.userId === session.user.id) {
        logger.info("voice_webrtc_create", {
          userId: session.user.id,
          sessionId,
          surface: input.surface,
          reused: true,
        });
        return {
          sessionId,
          iceServers: getVoiceIceServers(),
        };
      }

      await createWebrtcSession({
        userId: session.user.id,
        sessionId,
        surface: input.surface,
        runtime: ctx.runtimeContext,
      });

      logger.info("voice_webrtc_create", {
        userId: session.user.id,
        sessionId,
        surface: input.surface,
        reused: false,
      });

      return {
        sessionId,
        iceServers: getVoiceIceServers(),
      };
    }),

  webrtcOffer: authedProcedure
    .use(requirePolicy("voice.stt", toWebrtcResource))
    .use(requirePolicy("voice.tts", toWebrtcResource))
    .input(webrtcOfferInput)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      if (!isVoiceWebrtcEnabled()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "voice_webrtc_disabled",
        });
      }
      const existing = getWebrtcSession(input.sessionId);
      if (!existing || existing.userId !== session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "voice_webrtc_session_missing",
        });
      }
      try {
        logger.info("voice_webrtc_offer", {
          userId: session.user.id,
          sessionId: input.sessionId,
          sdpChars: input.offer.sdp.length,
        });
        const answer = await applyWebrtcOffer({
          sessionId: input.sessionId,
          offer: input.offer,
        });
        logger.info("voice_webrtc_answer", {
          userId: session.user.id,
          sessionId: input.sessionId,
          sdpChars: answer.sdp.length,
        });
        return answer;
      } catch (error) {
        throw toTRPCError(error, "voice_webrtc_offer_failed");
      }
    }),

  webrtcIce: authedProcedure
    .use(requirePolicy("voice.stt", toWebrtcResource))
    .use(requirePolicy("voice.tts", toWebrtcResource))
    .input(webrtcIceInput)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      if (!isVoiceWebrtcEnabled()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "voice_webrtc_disabled",
        });
      }
      const existing = getWebrtcSession(input.sessionId);
      if (!existing || existing.userId !== session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "voice_webrtc_session_missing",
        });
      }
      try {
        logger.info("voice_webrtc_ice", {
          userId: session.user.id,
          sessionId: input.sessionId,
        });
        await addWebrtcIceCandidate({
          sessionId: input.sessionId,
          candidate: input.candidate,
        });
      } catch (error) {
        throw toTRPCError(error, "voice_webrtc_ice_failed");
      }
      return { ok: true };
    }),

  webrtcCandidates: authedProcedure
    .use(requirePolicy("voice.stt", toWebrtcResource))
    .use(requirePolicy("voice.tts", toWebrtcResource))
    .input(webrtcSessionInput)
    .query(({ ctx, input }) => {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      if (!isVoiceWebrtcEnabled()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "voice_webrtc_disabled",
        });
      }
      const existing = getWebrtcSession(input.sessionId);
      if (!existing || existing.userId !== session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "voice_webrtc_session_missing",
        });
      }
      return {
        sessionId: input.sessionId,
        candidates: drainWebrtcIceCandidates(input.sessionId),
      };
    }),

  webrtcEnd: authedProcedure
    .use(requirePolicy("voice.stt", toWebrtcResource))
    .use(requirePolicy("voice.tts", toWebrtcResource))
    .input(webrtcSessionInput)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const existing = getWebrtcSession(input.sessionId);
      if (!existing || existing.userId !== session.user.id) {
        return { ok: true };
      }
      await closeWebrtcSession(input.sessionId, "client_end");
      return { ok: true };
    }),

  stream: authedProcedure
    .input(voiceStreamInput)
    .subscription(({ input, ctx }) =>
      observable<VoiceStreamEvent>((emit) => {
        const { session } = ctx;
        if (!session) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        const sessionId = input.sessionId ?? randomUUID();
        const timerStart = performance.now();
        markVoice("voice_stream_start");
        voiceStreamEventsTotal.inc({ event: "status", status: "connecting" });

        try {
          const { voiceRegistry } = getVoicePools();
          voiceRegistry.createSession(
            session.user.id,
            sessionId,
            input.language
          );

          emit.next({ _: "status", sessionId, state: "idle" });
          voiceStreamEventsTotal.inc({ event: "status", status: "connected" });
          markVoice("voice_stream_connected");

          return () => {
            const durationSeconds = (performance.now() - timerStart) / 1000;
            voiceStreamLatencySeconds.observe(
              { stage: "stream_session" },
              durationSeconds
            );
            voiceStreamEventsTotal.inc({
              event: "status",
              status: "disconnected",
            });
            markVoice("voice_stream_end");
            voiceRegistry.removeSession(sessionId);
            emit.next({ _: "status", sessionId, state: "idle" });
          };
        } catch (error) {
          voiceStreamEventsTotal.inc({ event: "error", status: "error" });
          markVoice("voice_stream_error");
          emit.error(
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "voice_stream_setup_failed",
              cause: error instanceof Error ? error : undefined,
            })
          );
          return () => {};
        }
      })
    ),

  /**
   * Subscribe to voice workflow notifications (completion, progress, phase).
   *
   * Clients subscribe to receive proactive updates about workflow execution
   * based on user notification preferences.
   */
  workflowNotification: authedProcedure.subscription(
    async function* workflowNotification({ ctx }) {
      const { subscribeToNotifications } = await import("../voice/notifier.js");

      const userId = ctx.session.user.id;
      const notifications: {
        type: "completion" | "progress" | "phase_complete";
        runId: string;
        message: string;
        notificationMode: string;
        audioBase64?: string;
        mimeType?: string;
      }[] = [];

      let resolveNext: (() => void) | undefined;

      const unsubscribe = subscribeToNotifications(userId, (event) => {
        notifications.push({
          type: event.type,
          runId: event.runId,
          message: event.message,
          notificationMode: event.notificationMode,
          audioBase64: event.audioBase64,
          mimeType: event.mimeType,
        });
        if (resolveNext) {
          resolveNext();
          resolveNext = undefined;
        }
      });

      try {
        while (true) {
          // Wait for notifications or timeout
          if (notifications.length === 0) {
            await new Promise<void>((resolve) => {
              resolveNext = resolve;
              // Heartbeat timeout - emit empty to keep connection alive
              setTimeout(resolve, 30_000);
            });
          }

          // Yield all pending notifications
          while (notifications.length > 0) {
            const notification = notifications.shift();
            if (notification) {
              yield notification;
            }
          }
        }
      } finally {
        unsubscribe();
      }
    }
  ),
});
