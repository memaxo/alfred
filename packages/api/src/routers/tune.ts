import { logger } from "@alfred/logger";
import { parseFineTuneConfig, runFineTuneJob } from "@alfred/tune";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

const startInput = z.object({
  projectId: z.string().uuid().optional(),
  config: z.unknown(),
  pythonBin: z.string().optional(),
  runsRoot: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

// In-memory job storage (would be persisted in DB after migration)
type TuneJobArtifacts = {
  outputDir?: string;
  adaptersPath?: string;
  fusedModelDir?: string;
  metricsPath?: string;
};

type TuneJob = {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  config: unknown;
  progress: {
    epoch: number;
    totalEpochs: number;
    step: number;
    totalSteps: number;
    loss: number;
    accuracy: number;
  } | null;
  artifacts: TuneJobArtifacts | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};
const jobsStore = new Map<string, TuneJob>();

// Sample datasets (would come from filesystem/DB in production)
const SAMPLE_DATASETS = [
  {
    id: "dataset-conversations",
    name: "Conversation History",
    description: "Fine-tune on past conversation patterns",
    samples: 15_420,
    size: "45.2 MB",
    format: "jsonl",
    lastUpdated: "2025-01-02",
  },
  {
    id: "dataset-code-completions",
    name: "Code Completions",
    description: "Code completion training data from accepted suggestions",
    samples: 8930,
    size: "23.1 MB",
    format: "jsonl",
    lastUpdated: "2025-01-01",
  },
  {
    id: "dataset-domain-knowledge",
    name: "Domain Knowledge",
    description: "Curated domain-specific Q&A pairs",
    samples: 2150,
    size: "8.7 MB",
    format: "jsonl",
    lastUpdated: "2024-12-28",
  },
  {
    id: "dataset-corrections",
    name: "User Corrections",
    description: "Training data from user feedback and corrections",
    samples: 1820,
    size: "5.4 MB",
    format: "jsonl",
    lastUpdated: "2025-01-03",
  },
];

// Sample model evaluations
const MODEL_EVALUATIONS = [
  {
    id: "model-base",
    name: "Base Model",
    version: "v1.0",
    accuracy: 0.82,
    latency: 145,
    tokensPerSec: 42,
    memoryUsage: 4.2,
    isBaseline: true,
  },
  {
    id: "model-finetuned-v1",
    name: "Fine-tuned v1",
    version: "v1.1",
    accuracy: 0.87,
    latency: 152,
    tokensPerSec: 40,
    memoryUsage: 4.3,
    isBaseline: false,
  },
  {
    id: "model-finetuned-v2",
    name: "Fine-tuned v2",
    version: "v1.2",
    accuracy: 0.91,
    latency: 158,
    tokensPerSec: 38,
    memoryUsage: 4.5,
    isBaseline: false,
  },
];

export const tuneRouter = router({
  start: authedProcedure.input(startInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id ?? "anonymous";
    const config = parseFineTuneConfig(input.config);

    // Create job record
    const jobId = crypto.randomUUID();
    const job: TuneJob = {
      id: jobId,
      userId,
      projectId: input.projectId,
      name: `Fine-tune ${new Date().toISOString().slice(0, 10)}`,
      status: "running",
      config: input.config,
      progress: null,
      artifacts: null,
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
    };
    jobsStore.set(jobId, job);

    try {
      const result = await runFineTuneJob(config, {
        workspaceRoot: process.cwd(),
        runsRoot: input.runsRoot,
        pythonBin: input.pythonBin,
        env: input.env,
      });

      // Update job with results
      job.status = result.status === "success" ? "completed" : "failed";
      job.artifacts = result.artifacts;
      job.completedAt = result.completedAt
        ? new Date(result.completedAt)
        : new Date();
      jobsStore.set(jobId, job);

      return {
        runId: result.runId,
        jobId,
        status: result.status,
        artifacts: result.artifacts,
        summary: result.summary,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
      };
    } catch (error) {
      job.status = "failed";
      job.completedAt = new Date();
      jobsStore.set(jobId, job);

      logger.error("tune_job_failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }),

  jobsList: authedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        status: z
          .enum(["pending", "running", "completed", "failed", "cancelled"])
          .optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
    )
    .query(({ ctx, input }) => {
      const userId = ctx.session?.user?.id ?? "anonymous";
      let jobs = [...jobsStore.values()].filter((j) => j.userId === userId);

      if (input.projectId) {
        jobs = jobs.filter((j) => j.projectId === input.projectId);
      }

      if (input.status) {
        jobs = jobs.filter((j) => j.status === input.status);
      }

      // Sort by createdAt descending
      jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        jobs: jobs.slice(0, input.limit).map((j) => ({
          id: j.id,
          name: j.name,
          status: j.status,
          progress: j.progress,
          createdAt: j.createdAt.toISOString(),
          startedAt: j.startedAt?.toISOString() ?? null,
          completedAt: j.completedAt?.toISOString() ?? null,
        })),
        total: jobs.length,
      };
    }),

  jobsGet: authedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(({ ctx, input }) => {
      const userId = ctx.session?.user?.id ?? "anonymous";
      const job = jobsStore.get(input.jobId);

      if (!job || job.userId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "job_not_found",
        });
      }

      return {
        id: job.id,
        name: job.name,
        status: job.status,
        config: job.config,
        progress: job.progress,
        artifacts: job.artifacts,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
      };
    }),

  jobsCancel: authedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(({ ctx, input }) => {
      const userId = ctx.session?.user?.id ?? "anonymous";
      const job = jobsStore.get(input.jobId);

      if (!job || job.userId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "job_not_found",
        });
      }

      if (job.status !== "pending" && job.status !== "running") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "job_not_cancellable",
        });
      }

      job.status = "cancelled";
      job.completedAt = new Date();
      jobsStore.set(input.jobId, job);

      logger.info("tune_job_cancelled", { jobId: input.jobId, userId });

      return { cancelled: true, jobId: input.jobId };
    }),

  datasetsList: authedProcedure.query(() => ({
    datasets: SAMPLE_DATASETS,
  })),

  evalCompare: authedProcedure
    .input(
      z.object({
        modelIds: z.array(z.string()).min(1).max(5).optional(),
      })
    )
    .query(({ input }) => {
      let models = MODEL_EVALUATIONS;

      if (input.modelIds && input.modelIds.length > 0) {
        models = models.filter((m) => input.modelIds?.includes(m.id));
      }

      return {
        models: models.map((m) => ({
          id: m.id,
          name: m.name,
          version: m.version,
          accuracy: m.accuracy,
          latency: m.latency,
          tokensPerSec: m.tokensPerSec,
          memoryUsage: m.memoryUsage,
          isBaseline: m.isBaseline,
        })),
        baseline: models.find((m) => m.isBaseline) ?? null,
      };
    }),
});
