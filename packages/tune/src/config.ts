import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";

const DEFAULT_TEMPLATE = "system-user-assistant-text";
const DEFAULT_RUNS_ROOT = path.join(process.cwd(), "tmp", "tune-runs");

const optionalString = z.string().trim().min(1).optional();

export const fineTuneBackendSchema = z.enum(["mlx", "unsloth"]);

export type FineTuneBackend = z.infer<typeof fineTuneBackendSchema>;

export const quantizationSchema = z.enum(["none", "q4", "q8", "fp16", "bf16"]).default("none");

export type QuantizationMode = z.infer<typeof quantizationSchema>;

export const modelConfigSchema = z
  .object({
    baseModelId: optionalString,
    baseModelPath: optionalString,
    modelType: optionalString,
    quantization: quantizationSchema,
    dtype: z.enum(["float32", "float16", "bfloat16", "int8", "int4"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.baseModelId && !value.baseModelPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseModelId"],
        message: "Provide either baseModelId (HuggingFace) or baseModelPath (local).",
      });
    }
  });

export type FineTuneModelConfig = z.infer<typeof modelConfigSchema>;

export const datasetConfigSchema = z
  .object({
    datasetId: z.string().trim().min(1, "datasetId is required"),
    trainSplit: z.string().trim().min(1).default("train"),
    evalSplit: z.string().trim().min(1).optional(),
    template: z.string().trim().min(1).default(DEFAULT_TEMPLATE),
    maxSamples: z.number().int().positive().optional(),
    trainRatio: z.number().min(0).max(1).optional(),
    evalRatio: z.number().min(0).max(1).optional(),
    shuffleSeed: z.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.trainRatio !== undefined && value.evalRatio !== undefined) {
      if (value.trainRatio + value.evalRatio > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["trainRatio"],
          message: "trainRatio + evalRatio must be <= 1.",
        });
      }
    }
  });

export type FineTuneDatasetConfig = z.infer<typeof datasetConfigSchema>;

export const trainingConfigSchema = z
  .object({
    epochs: z.number().int().positive().default(1),
    steps: z.number().int().positive().optional(),
    batchSize: z.number().int().positive().default(1),
    gradientAccumulation: z.number().int().min(1).default(1),
    learningRate: z.number().positive().default(1e-4),
    maxSeqLen: z.number().int().positive().default(2048),
    warmupSteps: z.number().int().min(0).default(0),
    weightDecay: z.number().min(0).default(0),
    seed: z.number().int().min(0).default(42),
  })
  .superRefine((value, ctx) => {
    if (value.steps !== undefined && value.steps < value.epochs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps"],
        message: "steps should exceed epochs when both are supplied.",
      });
    }
  });

export type FineTuneTrainingConfig = z.infer<typeof trainingConfigSchema>;

export const loraConfigSchema = z.object({
  enabled: z.boolean().default(true),
  rank: z.number().int().positive().default(8),
  alpha: z.number().positive().default(16),
  dropout: z.number().min(0).max(1).default(0),
  targetModules: z.array(z.string().trim().min(1)).default(["q_proj", "v_proj"]),
  layers: z.number().int().positive().optional(),
});

export type FineTuneLoraConfig = z.infer<typeof loraConfigSchema>;

export const outputConfigSchema = z.object({
  outputDir: z.string().trim().min(1, "outputDir is required"),
  logDir: optionalString,
  saveAdapters: z.boolean().default(true),
  fuseAdapters: z.boolean().default(false),
  runName: optionalString,
  keepCheckpoints: z.number().int().min(0).optional(),
});

export type FineTuneOutputConfig = z.infer<typeof outputConfigSchema>;

export const metadataSchema = z.object({
  description: optionalString,
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: optionalString,
});

export type FineTuneMetadata = z.infer<typeof metadataSchema>;

export const fineTuneConfigSchema = z.object({
  backend: fineTuneBackendSchema,
  model: modelConfigSchema,
  data: datasetConfigSchema,
  training: trainingConfigSchema,
  lora: loraConfigSchema,
  output: outputConfigSchema,
  metadata: metadataSchema.default({ tags: [] }),
});

export type FineTuneConfig = z.infer<typeof fineTuneConfigSchema>;

export const parseFineTuneConfig = (input: unknown): FineTuneConfig => fineTuneConfigSchema.parse(input);

export type RunPathOptions = {
  runsRoot?: string;
  runId?: string;
};

export type FineTuneRunPaths = {
  runId: string;
  runsRoot: string;
  runDir: string;
  datasetDir: string;
  logDir: string;
  configPath: string;
};

export const createRunPaths = (
  config: FineTuneConfig,
  options: RunPathOptions = {},
): FineTuneRunPaths => {
  const runId = options.runId ?? config.output.runName ?? randomUUID();
  const runsRoot = options.runsRoot ?? DEFAULT_RUNS_ROOT;
  const runDir = path.join(runsRoot, runId);
  const logDir = config.output.logDir ?? path.join(runDir, "logs");
  const datasetDir = path.join(runDir, "dataset");
  const configPath = path.join(runDir, "config.json");

  return {
    runId,
    runsRoot,
    runDir,
    datasetDir,
    logDir,
    configPath,
  };
};

export const defaults = {
  template: DEFAULT_TEMPLATE,
  runsRoot: DEFAULT_RUNS_ROOT,
};

