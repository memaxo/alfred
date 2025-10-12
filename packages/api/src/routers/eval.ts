import { runEval } from "@alfred/agent";
import * as evalRepo from "@alfred/db/repo/eval";
import type { EvalRunWithRelations } from "@alfred/db/repo/eval";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../index";
import { requirePolicy } from "../gate";

const slugSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9\-:_]+$/i, "Slug may contain letters, numbers, dashes, colons, or underscores.");

const defineInput = z.object({
  slug: slugSchema,
  agent: z.string().min(1).max(128),
  title: z.string().min(1).max(256).optional(),
  description: z.string().max(1024).optional(),
  config: z.any().optional(),
});

const datasetCreateInput = z.object({
  defSlug: slugSchema,
  name: z.string().min(1).max(256),
  source: z.enum(["manual", "trace", "import"]),
  description: z.string().max(1024).optional(),
});

const datasetAddInput = z.object({
  datasetId: z.string().uuid(),
  points: z
    .array(
      z.object({
        input: z.unknown(),
        target: z.unknown().optional(),
        metadata: z.unknown().optional(),
      }),
    )
    .min(1)
    .max(1000),
});

const datasetListInput = z.object({
  defSlug: slugSchema,
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

const runStartInput = z.object({
  defSlug: slugSchema,
  datasetId: z.string().uuid(),
  variant: z.string().min(1).max(64).optional(),
  laminar: z
    .object({
      enabled: z.boolean().optional(),
      mode: z.enum(["sdk", "api"]).optional(),
      groupName: z.string().min(1).max(128).optional(),
    })
    .optional(),
});

const runGetInput = z.object({
  runId: z.string().uuid(),
});

const runListInput = z.object({
  defSlug: slugSchema.optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

const runScoresInput = z.object({
  runId: z.string().uuid(),
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});

const mapEvalResource = (raw: unknown) => {
  const data = raw as Partial<{ defSlug?: string; datasetId?: string; runId?: string }>;
  return {
    kind: "eval" as const,
    id: data.defSlug ?? data.datasetId ?? data.runId ?? "eval",
  };
};

export const evalRouter = router({
  define: authedProcedure
    .use(requirePolicy("eval.define", mapEvalResource))
    .input(defineInput)
    .mutation(async ({ input }) => {
      const row = await evalRepo.upsertEvalDef({
        slug: input.slug,
        agent: input.agent,
        title: input.title,
        description: input.description,
        config: input.config ?? null,
      });
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "eval_definition_upsert_failed",
        });
      }
      return { id: row.id, slug: row.slug };
    }),

  list: authedProcedure
    .use(requirePolicy("eval.run", mapEvalResource))
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(({ input }) => evalRepo.listEvalDefs(input.limit, input.offset)),

  dataset: router({
    create: authedProcedure
      .use(requirePolicy("eval.dataset", mapEvalResource))
      .input(datasetCreateInput)
      .mutation(async ({ input }) => {
        const def = await evalRepo.getEvalDefBySlug(input.defSlug);
        if (!def) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "eval_definition_not_found",
          });
        }
        const created = await evalRepo.createDataset({
          defId: def.id,
          name: input.name,
          source: input.source,
          description: input.description,
        });
        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "eval_dataset_create_failed",
          });
        }
        return { id: created.id };
      }),

    add: authedProcedure
      .use(requirePolicy("eval.dataset", mapEvalResource))
      .input(datasetAddInput)
      .mutation(async ({ input }) => {
        const dataset = await evalRepo.getDatasetById(input.datasetId);
        if (!dataset) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "eval_dataset_not_found",
          });
        }
        const inserted = await evalRepo.addPoints(dataset.id, input.points);
        return { inserted };
      }),

    list: authedProcedure
      .use(requirePolicy("eval.run", mapEvalResource))
      .input(datasetListInput)
      .query(async ({ input }) => {
        const def = await evalRepo.getEvalDefBySlug(input.defSlug);
        if (!def) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "eval_definition_not_found",
          });
        }
        return evalRepo.listDatasets(def.id, input.limit, input.offset);
      }),
  }),

  run: router({
    start: authedProcedure
      .use(requirePolicy("eval.run", mapEvalResource))
      .input(runStartInput)
      .mutation(async ({ input }) => {
        const definition = await evalRepo.getEvalDefBySlug(input.defSlug);
        if (!definition) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "eval_definition_not_found",
          });
        }

        const dataset = await evalRepo.getDatasetById(input.datasetId);
        if (!dataset) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "eval_dataset_not_found",
          });
        }

        if (dataset.defId !== definition.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "dataset_definition_mismatch",
          });
        }

        try {
          const result = await runEval({
            def: { slug: definition.slug },
            datasetId: dataset.id,
            variant: input.variant,
            laminar: input.laminar,
          });

          return {
            runId: result.runId,
            counts: result.counts,
            stats: result.stats,
          };
        } catch (error) {
          throw toTRPCError(error);
        }
      }),

    get: authedProcedure
      .use(requirePolicy("eval.run", mapEvalResource))
      .input(runGetInput)
      .query(async ({ input }) => {
        const row = await evalRepo.getRun(input.runId);
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "eval_run_not_found",
          });
        }
        return formatRun(row);
      }),

    list: authedProcedure
      .use(requirePolicy("eval.run", mapEvalResource))
      .input(runListInput)
      .query(async ({ input }) => {
        const rows = await evalRepo.listRuns({
          defSlug: input.defSlug,
          limit: input.limit,
          offset: input.offset,
        });
        return rows.map(formatRun);
      }),

    scores: authedProcedure
      .use(requirePolicy("eval.run", mapEvalResource))
      .input(runScoresInput)
      .query(async ({ input }) => {
        const rows = await evalRepo.listRunScores(input.runId, input.limit, input.offset);
        return rows.map(row => ({
          pointId: row.point.id,
          scorer: row.score.scorer,
          score: row.score.score,
          reason: row.score.reason,
          metadata: row.score.metadata,
          recordedAt: row.score.createdAt,
        }));
      }),
  }),
});

function toTRPCError(error: unknown) {
  if (error instanceof TRPCError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "eval_run_failed";

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
  });
}

function formatRun(row: EvalRunWithRelations) {
  return {
    run: row.run,
    definition: row.def,
    dataset: row.dataset,
  };
}
