import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type { ContextOutput, InitOutput } from "./types";

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

      // Store context for later stages
      ctx.set("contextBundle", result.bundle);

      return {
        bundle: result.bundle ?? { files: [], maxTokens: 0, estimatedTokens: 0 },
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
