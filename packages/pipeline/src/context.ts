import type { PipelineEvent } from "./events";
import type { PipelineConfig, PipelineContext } from "./pipeline";

export type ContextOptions = {
  runId: string;
  requirement: string;
  workspace: string;
  userId: string;
  signal?: AbortSignal;
  config: PipelineConfig;
  emit: (event: PipelineEvent) => void;
};

export function createPipelineContext(
  options: ContextOptions
): PipelineContext {
  const storage = new Map<string, unknown>();
  const signal = options.signal ?? new AbortController().signal;

  return {
    runId: options.runId,
    requirement: options.requirement,
    workspace: options.workspace,
    userId: options.userId,
    signal,
    config: options.config,
    emit: options.emit,
    get: <T>(key: string) => storage.get(key) as T | undefined,
    set: (key, value) => storage.set(key, value),
  };
}
