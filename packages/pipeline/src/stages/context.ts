import * as crypto from "node:crypto";
import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type { SerializableValue } from "../snapshot";
import type { ContextOutput, InitOutput } from "./types";

/**
 * Hash a string to create a cache key.
 */
function hashRequirement(requirement: string): string {
  return crypto
    .createHash("sha256")
    .update(requirement)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Context Stage
 *
 * Gathers code and web context for the pipeline.
 * Supports caching to avoid redundant context gathering.
 */
export class ContextStage implements PipelineStage<InitOutput, ContextOutput> {
  readonly name = "context" as const;

  async execute(
    _input: InitOutput,
    ctx: PipelineContext
  ): Promise<ContextOutput> {
    ctx.emit(
      createEvent("stage:progress", {
        stage: "context",
        message: "Gathering code and web context",
      })
    );

    // Check cache if enabled
    if (ctx.config.contextCaching?.enabled) {
      const cached = await this.checkCache(ctx);
      if (cached) {
        return cached;
      }
    }

    // Build context
    const output = await this.buildContext(ctx);

    // Cache result if enabled
    if (ctx.config.contextCaching?.enabled) {
      await this.cacheResult(ctx, output);
    }

    // Store context for later stages
    ctx.set("contextBundle", output.bundle as unknown as SerializableValue);
    ctx.set("contextOutput", output as unknown as SerializableValue);

    return output;
  }

  /**
   * Check if cached context exists and is valid.
   */
  private async checkCache(
    ctx: PipelineContext
  ): Promise<ContextOutput | null> {
    const cacheKey = `context:${ctx.workspace}:${hashRequirement(ctx.requirement)}`;
    const cached = ctx.get<{
      output: ContextOutput;
      cachedAt: number;
    }>(cacheKey);

    if (!cached) {
      return null;
    }

    const ttl = ctx.config.contextCaching?.ttlMs ?? 300_000;
    const age = Date.now() - cached.cachedAt;

    if (age > ttl) {
      logger.info("context_cache_expired", {
        runId: ctx.runId,
        cacheKey,
        ageMs: age,
        ttlMs: ttl,
      });
      return null;
    }

    logger.info("context_cache_hit", {
      runId: ctx.runId,
      cacheKey,
      ageMs: age,
    });

    ctx.emit(
      createEvent("context:cache-hit", {
        cacheKey,
      })
    );

    ctx.emit(
      createEvent("stage:progress", {
        stage: "context",
        message: `Using cached context (${cached.output.totalTokens} tokens)`,
      })
    );

    return cached.output;
  }

  /**
   * Cache the context result.
   */
  private async cacheResult(
    ctx: PipelineContext,
    output: ContextOutput
  ): Promise<void> {
    const cacheKey = `context:${ctx.workspace}:${hashRequirement(ctx.requirement)}`;

    ctx.set(cacheKey, {
      output,
      cachedAt: Date.now(),
    } as unknown as SerializableValue);

    logger.info("context_cached", {
      runId: ctx.runId,
      cacheKey,
      totalTokens: output.totalTokens,
    });
  }

  /**
   * Build context using ContextBuilder.
   */
  private async buildContext(ctx: PipelineContext): Promise<ContextOutput> {
    try {
      // Import dynamically to avoid circular dependencies
      const { ContextBuilder } = await import("@alfred/runtime/context");
      const builder = new ContextBuilder();

      const result = await builder.build({
        requirement: ctx.requirement,
        workspace: ctx.workspace,
        maxTokens: 50_000,
        web: false, // Default to code-only for POC
      });

      const totalTokens = result.bundle?.estimatedTokens ?? 0;

      ctx.emit(
        createEvent("stage:progress", {
          stage: "context",
          message: `Gathered ${totalTokens} tokens of context`,
        })
      );

      return {
        bundle: result.bundle ?? {
          files: [],
          maxTokens: 0,
          estimatedTokens: 0,
        },
        receipts: {
          sources: result.receipts.code.map((r) => r.path ?? "unknown"),
          totalResults: result.receipts.code.length,
        },
        ragChunks: [], // RAG chunks not directly available from ExecutionContext
        totalTokens,
      };
    } catch (error) {
      logger.error("context_gathering_failed", {
        runId: ctx.runId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return minimal context on failure
      return {
        bundle: { files: [], maxTokens: 0, estimatedTokens: 0 },
        receipts: { sources: [], totalResults: 0 },
        ragChunks: [],
        totalTokens: 0,
      };
    }
  }
}
