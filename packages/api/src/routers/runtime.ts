import {
  getHealth as getEmbedHealth,
  shutdown as shutdownEmbedPool,
} from "@alfred/embed";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import {
  getVoicePools,
  initializeVoicePools,
  shutdownVoicePools,
} from "../voice/pools";
import { getContainerLogs, listContainers } from "./deploy-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Input Schemas
// ─────────────────────────────────────────────────────────────────────────────

const recoverInput = z.object({
  component: z.enum(["voice", "embed", "all"]),
});

const logsInput = z.object({
  component: z.enum(["voice", "embed", "alfred"]),
  tail: z.number().int().min(1).max(1000).default(100),
});

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export const runtimeRouter = router({
  /**
   * Get health status of all runtime components
   */
  status: authedProcedure.query(() => {
    let voiceStatus: { stt: unknown[]; tts: unknown[] } = { stt: [], tts: [] };
    try {
      const { sttPool, ttsPool } = getVoicePools();
      voiceStatus = {
        stt: sttPool.getHealth() as unknown[],
        tts: ttsPool.getHealth() as unknown[],
      };
    } catch (_e) {
      // Voice pools not initialized yet
    }

    let embedStatus: unknown[] = [];
    try {
      embedStatus = getEmbedHealth();
    } catch (_e) {
      // Embed pool error
    }

    return {
      voice: voiceStatus,
      embed: embedStatus,
      env: {
        VOICE_PROVIDER: process.env.VOICE_PROVIDER,
        EMBED_DEVICE: process.env.EMBED_DEVICE,
        VOICE_STREAMING_PROTO: process.env.VOICE_STREAMING_PROTO,
        NODE_ENV: process.env.NODE_ENV,
      },
      uptime: process.uptime(),
    };
  }),

  /**
   * Attempt to recover a failed component by restarting its pool
   */
  recover: authedProcedure.input(recoverInput).mutation(async ({ input }) => {
    const results: Record<string, boolean> = {};

    if (input.component === "voice" || input.component === "all") {
      try {
        logger.info("runtime_recover_voice_start");
        await shutdownVoicePools().catch((e) =>
          logger.error("voice_shutdown_failed", { e })
        );
        await initializeVoicePools();
        logger.info("runtime_recover_voice_complete");
        results.voice = true;
      } catch (error) {
        logger.error("runtime_recover_voice_failed", { error });
        results.voice = false;
      }
    }

    if (input.component === "embed" || input.component === "all") {
      try {
        logger.info("runtime_recover_embed_start");
        await shutdownEmbedPool().catch((e) =>
          logger.error("embed_shutdown_failed", { e })
        );
        // Embed pool will re-initialize lazily on next use
        logger.info("runtime_recover_embed_complete");
        results.embed = true;
      } catch (error) {
        logger.error("runtime_recover_embed_failed", { error });
        results.embed = false;
      }
    }

    return { ok: true, results };
  }),

  /**
   * Get logs for a specific runtime component from Docker
   */
  logs: authedProcedure.input(logsInput).query(async ({ input }) => {
    try {
      const containers = await listContainers("running");

      // Try to find the matching container
      const container = containers.find((c) => {
        const name = c.name.toLowerCase();
        const image = c.image.toLowerCase();

        if (input.component === "alfred") {
          return (
            name.includes("alfred") &&
            !name.includes("voice") &&
            !name.includes("embed")
          );
        }
        return (
          name.includes(input.component) || image.includes(input.component)
        );
      });

      if (!container) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `container_not_found_for_${input.component}`,
        });
      }

      const logs = await getContainerLogs(container.id, input.tail);
      return { logs };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "failed_to_fetch_runtime_logs",
        cause: error,
      });
    }
  }),
});
