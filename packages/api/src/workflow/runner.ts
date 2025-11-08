import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import type { WorkflowEvent } from "@alfred/type";

export type RunPlanInput = {
  requirement: string;
  auto: "read" | "low" | "medium" | "high";
  workspace?: string;
  repoBase?: string;
  mode?: "sequential" | "parallel";
  context?: {
    enable?: boolean;
    web?: boolean;
    topK?: number;
    maxTokens?: number;
    exts?: string[];
    ignore?: string[];
    seeds?: string[];
  };
};

export type ResumePayload = { event: "deploy-authz" | "linear-authz" | "bio-authz"; authz: string };

export type RunPlanV6 = {
  runId: string;
  summary: string;
  stream: AsyncGenerator<WorkflowEvent, void, void>;
  resume(payload: ResumePayload): Promise<void>;
  cancel(): void;
};

/**
 * Minimal, Mastra-free runner that emits WorkflowEvent chunks.
 *
 * This runner is intentionally simple: it models a planning phase with
 * context preparation and accepts resume events for authz acknowledgments.
 * The router owns persistence and run-registry wiring.
 */
export function runPlanV6(input: RunPlanInput, opts?: { signal?: AbortSignal }): RunPlanV6 {
  const runId = randomUUID();
  const summary = `Plan initialized for ${input.requirement}`;

  let cancelled = false;
  const resumeQueue: ResumePayload[] = [];

  const signal = opts?.signal;
  if (signal) {
    if (signal.aborted) cancelled = true;
    signal.addEventListener("abort", () => {
      cancelled = true;
    });
  }

  async function* generator(): AsyncGenerator<WorkflowEvent, void, void> {
    // Start
    yield { type: "run", id: runId } as unknown as WorkflowEvent;
    yield { type: "notice", message: `Planning started for ${input.requirement}` };
    yield { type: "progress", pct: 5, message: "initializing" };

    // Simulate context preparation if enabled
    if (input.context?.enable !== false) {
      if (cancelled) return;
      yield { type: "progress", pct: 10, message: "analyzing requirement" };
      await delay(50);
      if (cancelled) return;
      yield {
        type: "context",
        phase: "scan",
        message: "Scanning repository and web context (placeholder)",
      } as unknown as WorkflowEvent;
      yield { type: "progress", pct: 45, message: "context prepared" };
    }

    // If medium/high autonomy, request elevated scopes (placeholder event)
    if (input.auto === "medium" || input.auto === "high") {
      yield {
        type: "require-scope",
        scopes: ["repo.write", "droid.exec"],
        event: "bio-authz",
      } as unknown as WorkflowEvent;
      // Wait briefly for a resume event, but do not block indefinitely.
      const deadline = Date.now() + 10_000; // 10s soft wait
      while (!cancelled && Date.now() < deadline) {
        if (resumeQueue.length > 0) {
          const resume = resumeQueue.shift()!;
          yield { type: "notice", message: `Authorization '${resume.event}' acknowledged.` };
          break;
        }
        await delay(100);
      }
    }

    if (cancelled) return;
    yield { type: "progress", pct: 80, message: "validating plan" };
    await delay(50);
    if (cancelled) return;
    yield { type: "progress", pct: 100, message: "workflow_completed" };
  }

  return {
    runId,
    summary,
    stream: generator(),
    async resume(payload: ResumePayload) {
      resumeQueue.push(payload);
    },
    cancel() {
      cancelled = true;
    },
  };
}

