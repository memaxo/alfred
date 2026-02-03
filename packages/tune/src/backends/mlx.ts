import { spawn } from "bun";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FineTuneConfig } from "../config";
import type {
  FineTuneJobOptions,
  FineTuneLogEvent,
  FineTuneRunResult,
  FineTuneRunSummary,
} from "../run-types";

import { createRunPaths, defaults } from "../config";
import { fineTuneSamplesTotal, fineTuneTokensTotal } from "../metrics";

type StreamSource = "stdout" | "stderr";

const PYTHON_MODULE = "mlx_finetune.train_lora";

export const runMlxFineTune = async (
  config: FineTuneConfig,
  options: FineTuneJobOptions = {}
): Promise<FineTuneRunResult> => {
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const runsRoot =
    options.runsRoot ??
    defaults.runsRoot ??
    path.join(workspaceRoot, "tmp", "tune-runs");
  const runPaths = createRunPaths(config, { runsRoot });
  const resolvedOutputDir = resolvePath(workspaceRoot, config.output.outputDir);
  const resolvedLogDir = config.output.logDir
    ? resolvePath(workspaceRoot, config.output.logDir)
    : runPaths.logDir;

  await Promise.all([
    mkdir(runPaths.runDir, { recursive: true }),
    mkdir(runPaths.datasetDir, { recursive: true }),
    mkdir(resolvedLogDir, { recursive: true }),
    mkdir(resolvedOutputDir, { recursive: true }),
  ]);

  const pythonConfig = {
    ...config,
    output: {
      ...config.output,
      outputDir: resolvedOutputDir,
      logDir: resolvedLogDir,
    },
    paths: runPaths,
    workspaceRoot,
  };

  await writeFile(
    runPaths.configPath,
    JSON.stringify(pythonConfig, null, 2),
    "utf8"
  );

  const pythonPathSegment = path.join(
    workspaceRoot,
    "packages",
    "tune",
    "python"
  );
  const pythonPath = mergePythonPath(
    pythonPathSegment,
    options.env?.PYTHONPATH ?? process.env.PYTHONPATH
  );
  const env = {
    ...process.env,
    ...options.env,
    PYTHONPATH: pythonPath,
  };

  const pythonBin = options.pythonBin ?? "python3";
  const args = ["-m", PYTHON_MODULE, "--config", runPaths.configPath];
  const startedAt = new Date();
  const summary: FineTuneRunSummary = {};
  let samplesProcessed = 0;
  let tokensProcessed = 0;

  const proc = spawn({
    cmd: [pythonBin, ...args],
    cwd: workspaceRoot,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  let aborted = false;
  const abortHandler = () => {
    aborted = true;
    proc.kill();
    emitLog(options, {
      source: "system",
      level: "warn",
      timestamp: Date.now(),
      raw: "Abort signal received. Terminating MLX fine-tune subprocess.",
    });
  };

  options.abortSignal?.addEventListener("abort", abortHandler, { once: true });

  const stdoutPromise = consumeStream(
    proc.stdout,
    "stdout",
    options,
    summary,
    (payload) => {
      samplesProcessed = Math.max(
        samplesProcessed,
        extractNumber(payload, "samples") ?? samplesProcessed
      );
      tokensProcessed = Math.max(
        tokensProcessed,
        extractNumber(payload, "tokens") ?? tokensProcessed
      );
    }
  );
  const stderrPromise = consumeStream(proc.stderr, "stderr", options, summary);

  const exitCode = await proc.exited;
  await Promise.all([stdoutPromise, stderrPromise]);

  options.abortSignal?.removeEventListener("abort", abortHandler);

  const completedAt = new Date();
  const status: FineTuneRunResult["status"] = aborted
    ? "cancelled"
    : exitCode === 0
      ? "success"
      : "failed";

  if (tokensProcessed > 0) {
    fineTuneTokensTotal.inc({ backend: "mlx" }, tokensProcessed);
  }
  if (samplesProcessed > 0) {
    fineTuneSamplesTotal.inc({ backend: "mlx" }, samplesProcessed);
  }

  const adaptersDir = path.join(resolvedOutputDir, "adapters");
  const adaptersPath = config.output.saveAdapters
    ? path.join(adaptersDir, "adapters.safetensors")
    : undefined;

  return {
    backend: "mlx",
    runId: runPaths.runId,
    status,
    startedAt,
    completedAt,
    exitCode,
    paths: runPaths,
    artifacts: {
      outputDir: resolvedOutputDir,
      adaptersPath,
      fusedModelDir: config.output.fuseAdapters ? resolvedOutputDir : undefined,
    },
    summary,
  };
};

const resolveWorkspaceRoot = (candidate?: string) => {
  if (candidate && path.isAbsolute(candidate)) {
    return candidate;
  }
  if (candidate) {
    return path.resolve(process.cwd(), candidate);
  }
  return process.cwd();
};

const resolvePath = (workspaceRoot: string, target: string) =>
  path.isAbsolute(target) ? target : path.join(workspaceRoot, target);

const mergePythonPath = (segment: string, existing?: string) =>
  existing && existing.length > 0
    ? `${segment}${path.delimiter}${existing}`
    : segment;

const consumeStream = async (
  stream: ReadableStream<Uint8Array> | undefined,
  source: StreamSource,
  options: FineTuneJobOptions,
  summary: FineTuneRunSummary,
  onPayload?: (payload: Record<string, unknown>) => void
) => {
  if (!stream) {
    return;
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = processBuffer(buffer, source, options, summary, onPayload);
  }
  if (buffer.length > 0) {
    processLine(buffer, source, options, summary, onPayload);
  }
};

const processBuffer = (
  buffer: string,
  source: StreamSource,
  options: FineTuneJobOptions,
  summary: FineTuneRunSummary,
  onPayload?: (payload: Record<string, unknown>) => void
) => {
  let remaining = buffer;
  while (true) {
    const newlineIndex = remaining.indexOf("\n");
    if (newlineIndex === -1) {
      break;
    }
    const line = remaining.slice(0, newlineIndex);
    remaining = remaining.slice(newlineIndex + 1);
    processLine(line, source, options, summary, onPayload);
  }
  return remaining;
};

const processLine = (
  line: string,
  source: StreamSource,
  options: FineTuneJobOptions,
  summary: FineTuneRunSummary,
  onPayload?: (payload: Record<string, unknown>) => void
) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  const event: FineTuneLogEvent = {
    source,
    timestamp: Date.now(),
    raw: trimmed,
  };
  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    if (payload && typeof payload === "object") {
      event.data = payload;
      if (typeof payload.level === "string") {
        event.level = payload.level as FineTuneLogEvent["level"];
      }
      updateSummary(summary, payload);
      onPayload?.(payload);
    }
  } catch {
    // Non-JSON log line.
  }
  emitLog(options, event);
};

const updateSummary = (
  summary: FineTuneRunSummary,
  payload: Record<string, unknown>
) => {
  if (typeof payload.step === "number") {
    summary.stepsCompleted = payload.step;
  }
  if (typeof payload.epoch === "number") {
    summary.epochsCompleted = payload.epoch;
  }
  if (typeof payload.tokensProcessed === "number") {
    summary.tokensProcessed = payload.tokensProcessed;
  } else if (typeof payload.tokens === "number") {
    summary.tokensProcessed = payload.tokens;
  }
  if (typeof payload.samplesProcessed === "number") {
    summary.samplesProcessed = payload.samplesProcessed;
  }
  if (typeof payload.loss === "number") {
    summary.loss = payload.loss;
  }
  if (typeof payload.learning_rate === "number") {
    summary.learningRate = payload.learning_rate;
  }
};

const extractNumber = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
};

const emitLog = (options: FineTuneJobOptions, event: FineTuneLogEvent) => {
  options.onLog?.(event);
};
