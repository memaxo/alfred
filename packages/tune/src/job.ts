import type { FineTuneBackend, FineTuneConfig } from "./config";
import type { FineTuneJobOptions, FineTuneRunResult } from "./run-types";

import { runMlxFineTune } from "./backends/mlx";
import { fineTuneRunDurationSeconds, fineTuneRunsTotal } from "./metrics";

type BackendRunner = (
  config: FineTuneConfig,
  options: FineTuneJobOptions
) => Promise<FineTuneRunResult>;

const getBackendRunner = (backend: FineTuneBackend): BackendRunner => {
  switch (backend) {
    case "mlx":
      return runMlxFineTune;
    default:
      return async () => {
        throw new Error(`Fine-tune backend ${backend} is not implemented yet.`);
      };
  }
};

export const runFineTuneJob = async (
  config: FineTuneConfig,
  options: FineTuneJobOptions = {}
): Promise<FineTuneRunResult> => {
  const runner = getBackendRunner(config.backend);
  const startedAt = new Date();
  try {
    const result = await runner(config, options);
    recordMetrics(config.backend, result.status, startedAt, result.completedAt);
    return result;
  } catch (error) {
    recordMetrics(config.backend, "failed", startedAt, new Date());
    throw error;
  }
};

const recordMetrics = (
  backend: FineTuneBackend,
  status: "success" | "failed" | "cancelled",
  startedAt: Date,
  completedAt: Date
) => {
  fineTuneRunsTotal.inc({ backend, status });
  const durationSeconds = Math.max(
    0,
    (completedAt.getTime() - startedAt.getTime()) / 1000
  );
  fineTuneRunDurationSeconds.observe({ backend, status }, durationSeconds);
};
