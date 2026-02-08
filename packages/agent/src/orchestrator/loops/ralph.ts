/**
 * Ralph Wiggum Loop Implementation
 *
 * Iterative development methodology where the same prompt is fed repeatedly
 * until task completion. Agents see their previous work in files and git history.
 *
 * Core concept (Geoffrey Huntley):
 * - Same prompt fed to agent repeatedly
 * - Self-referential: agent sees own previous work in files
 * - Completion signaled via <promise>TEXT</promise> tag
 * - Max iterations as safety bound
 *
 * @see https://ghuntley.com/ralph/
 */

import { LoopDetector, type LoopResult } from "@alfred/cognitive";
import { logger } from "@alfred/logger";
import { z } from "zod";

import type { ToolWriter } from "../tool/shared/context.js";

import { type CodexToolInput, toolCodex } from "../tool/codex/index.js";
import { type DroidToolInput, toolDroid } from "../tool/droid.js";
import {
  type OpenCodeToolInput,
  toolOpenCode,
} from "../tool/opencode/index.js";
import {
  recordRalphCompletion,
  recordRalphIteration,
  recordRalphStuck,
  recordRalphTimeout,
} from "./metrics.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for Ralph loop execution
 */
export interface RalphConfig {
  /** Maximum iterations before forced termination (default: 10) */
  maxIterations: number;
  /** Text to detect in <promise>TEXT</promise> tag for completion */
  completionPromise?: string;
  /** Override LoopDetector stall timeout (default: 60000ms) */
  stallMs?: number;
  /** Override LoopDetector similarity threshold (default: 0.92) */
  similarityThreshold?: number;
}

const DEFAULT_RALPH_CONFIG: Required<Omit<RalphConfig, "completionPromise">> & {
  completionPromise?: string;
} = {
  maxIterations: 10,
  completionPromise: undefined,
  stallMs: 60_000,
  similarityThreshold: 0.92,
};

/**
 * Result of Ralph loop execution
 */
export interface RalphResult {
  /** Whether task completed successfully (promise detected) */
  completed: boolean;
  /** Number of iterations executed */
  iterations: number;
  /** The promise text detected if completion occurred */
  promiseDetected?: string;
  /** Final result text from last iteration */
  result: string;
  /** Reason for termination if stuck or max iterations */
  stuckReason?: string;
  /** All artifacts collected across iterations */
  artifacts: { path: string; kind: string }[];
}

/**
 * State persisted between iterations
 */
export interface RalphState {
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** Original prompt being fed repeatedly */
  prompt: string;
  /** Configuration for this loop */
  config: RalphConfig;
  /** Accumulated results from iterations */
  results: string[];
  /** Timestamp when loop started */
  startedAt: number;
  /** Whether loop is active */
  active: boolean;
}

/**
 * Input parameters for Ralph loop
 */
export interface RalphInput {
  /** Which executor to use */
  executor: "codex" | "droid" | "opencode";
  /** The prompt to feed repeatedly */
  prompt: string;
  /** Ralph configuration */
  config: RalphConfig;
  /** Tool-specific input (minus prompt, which is managed by Ralph) */
  toolInput:
    | Omit<CodexToolInput, "prompt" | "action">
    | Omit<DroidToolInput, "prompt">
    | Omit<OpenCodeToolInput, "prompt" | "action">;
  /** Optional stream writer for real-time output */
  writer?: ToolWriter;
  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ralphConfigSchema = z.object({
  maxIterations: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum iterations before forced termination"),
  completionPromise: z
    .string()
    .min(1)
    .optional()
    .describe("Text to detect in <promise>TEXT</promise> tag for completion"),
  stallMs: z
    .number()
    .int()
    .min(1000)
    .max(300_000)
    .optional()
    .describe("Stall detection timeout in milliseconds"),
  similarityThreshold: z
    .number()
    .min(0.5)
    .max(1)
    .optional()
    .describe("Semantic similarity threshold for loop detection"),
});

export const ralphResultSchema = z.object({
  completed: z.boolean(),
  iterations: z.number().int().min(0),
  promiseDetected: z.string().optional(),
  result: z.string(),
  stuckReason: z.string().optional(),
  artifacts: z.array(
    z.object({
      path: z.string(),
      kind: z.string(),
    })
  ),
});

export const ralphStateSchema = z.object({
  iteration: z.number().int().min(0),
  prompt: z.string(),
  config: ralphConfigSchema,
  results: z.array(z.string()),
  startedAt: z.number(),
  active: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Promise Detection
// ─────────────────────────────────────────────────────────────────────────────

const PROMISE_PATTERN = /<promise>([\s\S]*?)<\/promise>/i;

/**
 * Extract promise text from agent output.
 * Only accepts <promise>TEXT</promise> format.
 */
export function extractPromise(output: string): string | null {
  const match = output.match(PROMISE_PATTERN);
  if (!match || match[1] === undefined) {
    return null;
  }
  return match[1].trim();
}

/**
 * Check if extracted promise matches the expected completion promise.
 */
export function isPromiseMatch(
  extracted: string | null,
  expected: string | undefined
): boolean {
  if (!extracted) {
    return false;
  }
  if (!expected) {
    // If no specific promise expected, any promise signals completion
    return true;
  }
  return extracted.toLowerCase().includes(expected.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// State Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create initial Ralph state
 */
export function createRalphState(
  prompt: string,
  config: RalphConfig
): RalphState {
  return {
    iteration: 0,
    prompt,
    config: { ...DEFAULT_RALPH_CONFIG, ...config },
    results: [],
    startedAt: Date.now(),
    active: true,
  };
}

/**
 * Update state after an iteration
 */
export function updateRalphState(
  state: RalphState,
  result: string
): RalphState {
  return {
    ...state,
    iteration: state.iteration + 1,
    results: [...state.results, result],
  };
}

/**
 * Mark state as inactive (completed or terminated)
 */
export function deactivateRalphState(state: RalphState): RalphState {
  return {
    ...state,
    active: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build iteration prompt with context about current iteration
 */
function buildIterationPrompt(state: RalphState): string {
  const iterationContext =
    state.iteration === 0
      ? ""
      : `\n\n[Ralph Loop: Iteration ${state.iteration + 1}/${state.config.maxIterations}. ` +
        "Review your previous work in the files and continue toward completion. " +
        `Output <promise>${state.config.completionPromise ?? "TASK COMPLETE"}</promise> ` +
        "when finished.]";

  return state.prompt + iterationContext;
}

/**
 * Execute a single iteration using the specified executor
 */
async function executeIteration(
  executor: "codex" | "droid" | "opencode",
  prompt: string,
  toolInput: RalphInput["toolInput"],
  writer: ToolWriter,
  signal?: AbortSignal
): Promise<{
  result: string;
  artifacts: { path: string; kind: string }[];
}> {
  const execProfileStrict =
    process.env.ORCH_EXEC_PROFILE_STRICT?.trim() === "1";

  if (executor === "codex") {
    const codexInput = toolInput as Omit<CodexToolInput, "prompt" | "action">;
    const run = (overrides?: Partial<CodexToolInput>) =>
      toolCodex.execute({
        input: {
          action: "exec",
          prompt,
          ...codexInput,
          ...(overrides ?? {}),
        },
        writer,
        signal,
      });

    let output: Awaited<ReturnType<typeof toolCodex.execute>>;
    try {
      output = await run();
    } catch (error) {
      if (
        !(execProfileStrict || signal?.aborted) &&
        error instanceof Error &&
        error.message === "codex_server_start_failed" &&
        codexInput.execProfile !== "default"
      ) {
        void Promise.resolve(
          writer?.write?.({
            type: "notice",
            message: "executor_server_fallback_default",
          })
        ).catch(() => {});
        output = await run({ execProfile: "default" });
      } else {
        throw error;
      }
    }
    return {
      result: output.result,
      artifacts: output.artifacts ?? [],
    };
  }

  if (executor === "droid") {
    const droidInput = toolInput as Omit<DroidToolInput, "prompt">;
    const output = await toolDroid.execute({
      input: {
        prompt,
        ...droidInput,
      },
      writer,
      signal,
    });
    return {
      result: output.result,
      artifacts: output.artifacts ?? [],
    };
  }

  const ocInput = toolInput as Omit<OpenCodeToolInput, "prompt" | "action">;
  const run = (overrides?: Partial<OpenCodeToolInput>) =>
    toolOpenCode.execute({
      input: {
        action: "exec",
        prompt,
        ...ocInput,
        ...(overrides ?? {}),
      },
      writer,
      signal,
    });

  let output: Awaited<ReturnType<typeof toolOpenCode.execute>>;
  try {
    output = await run();
  } catch (error) {
    if (
      !(execProfileStrict || signal?.aborted) &&
      error instanceof Error &&
      error.message === "opencode_server_start_failed" &&
      ocInput.execProfile !== "default"
    ) {
      void Promise.resolve(
        writer?.write?.({
          type: "notice",
          message: "executor_server_fallback_default",
        })
      ).catch(() => {});
      output = await run({ execProfile: "default" });
    } else {
      throw error;
    }
  }
  return {
    result: output.result,
    artifacts: output.artifacts ?? [],
  };
}

/**
 * Run the Ralph Wiggum loop.
 *
 * Iteratively executes the same prompt until:
 * 1. <promise>TEXT</promise> detected matching completionPromise
 * 2. Max iterations reached
 * 3. LoopDetector identifies stuck state (semantic similarity or stall)
 * 4. AbortSignal triggered
 */
export async function runRalphLoop(params: RalphInput): Promise<RalphResult> {
  const { executor, prompt, config, toolInput, writer, signal } = params;
  const mergedConfig = { ...DEFAULT_RALPH_CONFIG, ...config };

  // Initialize state
  let state = createRalphState(prompt, mergedConfig);

  // Initialize loop detector for stuck detection
  const loopDetector = new LoopDetector({
    maxTransitions: mergedConfig.maxIterations * 10, // Allow multiple checks per iteration
    stallMs: mergedConfig.stallMs,
    similarityThreshold: mergedConfig.similarityThreshold,
    windowSize: 8,
  });

  const allArtifacts: { path: string; kind: string }[] = [];
  let lastResult = "";
  let stuckReason: string | undefined;

  logger.info("ralph_loop_started", {
    executor,
    maxIterations: mergedConfig.maxIterations,
    completionPromise: mergedConfig.completionPromise,
  });

  // Emit start notice
  void writer?.write?.({
    type: "notice",
    message: "ralph_loop_started",
    config: {
      maxIterations: mergedConfig.maxIterations,
      completionPromise: mergedConfig.completionPromise,
    },
  });

  while (state.active && state.iteration < mergedConfig.maxIterations) {
    // Check for abort signal
    if (signal?.aborted) {
      logger.info("ralph_loop_aborted", { iteration: state.iteration });
      stuckReason = "aborted";
      break;
    }

    const iterationPrompt = buildIterationPrompt(state);

    // Emit iteration start
    void writer?.write?.({
      type: "notice",
      message: "ralph_iteration_started",
      iteration: state.iteration + 1,
      maxIterations: mergedConfig.maxIterations,
    });

    try {
      // Execute iteration
      const { result, artifacts } = await executeIteration(
        executor,
        iterationPrompt,
        toolInput,
        writer,
        signal
      );

      lastResult = result;
      allArtifacts.push(...artifacts);

      // Record metrics
      recordRalphIteration(executor, state.iteration + 1);

      // Check for promise completion
      const extractedPromise = extractPromise(result);
      if (isPromiseMatch(extractedPromise, mergedConfig.completionPromise)) {
        logger.info("ralph_loop_completed", {
          iteration: state.iteration + 1,
          promiseDetected: extractedPromise,
        });

        recordRalphCompletion(executor, state.iteration + 1);

        void writer?.write?.({
          type: "notice",
          message: "ralph_loop_completed",
          iteration: state.iteration + 1,
          promiseDetected: extractedPromise,
        });

        return {
          completed: true,
          iterations: state.iteration + 1,
          promiseDetected: extractedPromise ?? undefined,
          result: lastResult,
          artifacts: allArtifacts,
        };
      }

      // Check for stuck state via LoopDetector
      const loopResult: LoopResult = loopDetector.check(result, null);
      if (loopResult.loop) {
        logger.warn("ralph_loop_stuck", {
          iteration: state.iteration + 1,
          reason: loopResult.reason,
          layer: loopResult.layer,
        });

        recordRalphStuck(executor, loopResult.reason);

        stuckReason = `stuck:${loopResult.reason}`;
        state = deactivateRalphState(state);

        void writer?.write?.({
          type: "notice",
          message: "ralph_loop_stuck",
          iteration: state.iteration + 1,
          reason: loopResult.reason,
        });

        break;
      }

      // Update state for next iteration
      state = updateRalphState(state, result);

      void writer?.write?.({
        type: "notice",
        message: "ralph_iteration_completed",
        iteration: state.iteration,
        hasPromise: Boolean(extractedPromise),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("ralph_iteration_error", {
        iteration: state.iteration + 1,
        error: errorMessage,
      });

      // Check if it's a timeout
      if (errorMessage.includes("timeout")) {
        recordRalphTimeout(executor);
        stuckReason = `timeout:${errorMessage}`;
      } else {
        stuckReason = `error:${errorMessage}`;
      }

      void writer?.write?.({
        type: "notice",
        message: "ralph_iteration_error",
        iteration: state.iteration + 1,
        error: errorMessage,
      });

      // Continue to next iteration unless aborted
      state = updateRalphState(state, `[ERROR: ${errorMessage}]`);
    }
  }

  // Max iterations reached or terminated
  if (!stuckReason && state.iteration >= mergedConfig.maxIterations) {
    stuckReason = "max_iterations";
    recordRalphStuck(executor, "max_iterations");

    logger.warn("ralph_loop_max_iterations", {
      iterations: state.iteration,
    });

    void writer?.write?.({
      type: "notice",
      message: "ralph_loop_max_iterations",
      iterations: state.iteration,
    });
  }

  return {
    completed: false,
    iterations: state.iteration,
    result: lastResult,
    stuckReason,
    artifacts: allArtifacts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────────────────────

export const ralphInputSchema = z.object({
  executor: z
    .enum(["codex", "droid", "opencode"])
    .describe("Which coding agent to use"),
  prompt: z.string().min(1).describe("The prompt to feed repeatedly"),
  config: ralphConfigSchema.describe("Ralph loop configuration"),
  execProfile: z
    .enum(["default", "server"])
    .optional()
    .describe(
      "Execution profile: default spawns per prompt; server reuses a long-lived backend in AgentFS (codex/opencode)."
    ),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  cw: z.string().optional().describe("Working directory"),
  model: z.string().optional().describe("Model to use"),
  authz: z.string().optional().describe("Authorization token"),
  timeoutSec: z.number().int().min(30).max(1800).optional(),
  sessionId: z.string().optional().describe("Session ID for Codex"),
  userId: z.string().optional().describe("User ID for session binding"),
  agentfsDbPath: z
    .string()
    .optional()
    .describe("AgentFS database path (Codex executor only)"),
  cmd: z
    .string()
    .optional()
    .describe("ACP agent command override (OpenCode executor only)"),
  args: z
    .array(z.string())
    .optional()
    .describe("ACP agent args override (OpenCode executor only)"),
  containerName: z
    .string()
    .describe("AgentFS container name/id (Codex/OpenCode executors only)"),
  containerCw: z
    .string()
    .describe("Workdir inside the container (Codex/OpenCode executors only)"),
});

export type RalphToolInput = z.infer<typeof ralphInputSchema>;

export const toolRalph = {
  name: "ralph",
  description:
    "Run iterative Ralph Wiggum loop with Codex or Droid until task completion. " +
    "Same prompt is fed repeatedly; agent sees previous work in files. " +
    "Output <promise>TEXT</promise> to signal completion.",
  inputSchema: ralphInputSchema,
  outputSchema: ralphResultSchema,
  execute: async ({
    input,
    writer,
    signal,
  }: {
    input: RalphToolInput;
    writer?: ToolWriter;
    signal?: AbortSignal;
  }): Promise<RalphResult> => {
    const { executor, prompt, config, ...toolInputRest } = input;

    const toolInput =
      executor === "codex"
        ? {
            out: "text" as const,
            execProfile: toolInputRest.execProfile,
            auto: toolInputRest.auto,
            cw: toolInputRest.cw,
            model: toolInputRest.model,
            authz: toolInputRest.authz,
            timeoutSec: toolInputRest.timeoutSec,
            sessionId: toolInputRest.sessionId,
            userId: toolInputRest.userId,
            agentfsDbPath: toolInputRest.agentfsDbPath,
            containerName: toolInputRest.containerName,
            containerCw: toolInputRest.containerCw,
          }
        : (executor === "droid"
          ? {
              out: "text" as const,
              auto: toolInputRest.auto,
              cw: toolInputRest.cw,
              model: toolInputRest.model,
              authz: toolInputRest.authz,
              timeoutSec: toolInputRest.timeoutSec,
            }
          : {
              execProfile: toolInputRest.execProfile,
              auto: toolInputRest.auto,
              cw: toolInputRest.cw,
              model: toolInputRest.model,
              authz: toolInputRest.authz,
              timeoutSec: toolInputRest.timeoutSec,
              sessionId: toolInputRest.sessionId,
              cmd: toolInputRest.cmd,
              args: toolInputRest.args,
              containerName: toolInputRest.containerName,
              containerCw: toolInputRest.containerCw,
            });

    return await runRalphLoop({
      executor,
      prompt,
      config,
      toolInput,
      writer,
      signal,
    });
  },
};

export type ToolRalph = typeof toolRalph;
