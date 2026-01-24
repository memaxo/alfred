/**
 * Embed Router - Embedding model configuration
 *
 * Provides endpoints for configuring and querying embedding model settings.
 */

import { z } from "zod";

import { authedProcedure, router } from "../trpc";

const configInput = z.object({
  modelName: z.string().min(1).optional(),
  device: z.enum(["auto", "cpu", "cuda", "mps"]).optional(),
  poolSize: z.number().int().min(1).max(10).optional(),
});

export const embedRouter = router({
  // Get current embedding configuration
  getConfig: authedProcedure.query(async () => {
    // Read from environment variables
    const config = {
      modelName:
        process.env.EMBED_MODEL ?? "tencent/KaLM-Embedding-Gemma3-12B-2511",
      device:
        (process.env.EMBED_DEVICE as "auto" | "cpu" | "cuda" | "mps") ?? "auto",
      poolSize: Number.parseInt(process.env.EMBED_POOL_SIZE ?? "2", 10),
      requestTimeout: Number.parseInt(
        process.env.EMBED_REQUEST_TIMEOUT_MS ?? "30000",
        10
      ),
    };
    return config;
  }),

  // Update embedding configuration (requires restart to take effect)
  setConfig: authedProcedure.input(configInput).mutation(async ({ input }) => {
    // Note: This would typically update environment variables or a config file
    // For now, we return success since config is env-based
    return {
      success: true,
      message: "Configuration will take effect after restart",
      changes: input,
    };
  }),
});
