import type { WorkflowEvent } from "@alfred/type/plan";

import { generateConflictExecPlanSkeleton } from "@alfred/agent/orchestrator/multi/conflict";
import { plansPath } from "@alfred/agent/orchestrator/plans";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { logger } from "@alfred/logger";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { OrchestratorContext } from "./types";

import { formatCodexRuntimeError } from "../utils/codex-error";
import { resolveAgentfsContainer, resolveAgentfsContainerCw } from "./agentfs";

export async function* runConflictPhase(
  ctx: OrchestratorContext,
  conflictScanResult: any
): AsyncGenerator<WorkflowEvent, void, void> {
  const { input, runId, workspace, authz, signal, userId } = ctx;

  if (conflictScanResult && conflictScanResult.totalMarkers > 0) {
    const { containerName, containerBaseCw } = await resolveAgentfsContainer({
      runId,
      workspace,
      userId,
    });
    const containerCw = resolveAgentfsContainerCw({
      workspaceRoot: workspace,
      workingDirectory: workspace,
      containerBaseCw,
    });

    yield {
      type: "event",
      kind: "merge-conflict",
      data: conflictScanResult,
    } as any;

    // Conflict analysis agent (analysis-only; no edits)
    const conflictExecPlanPath = plansPath(workspace, runId, "conflict.md");
    const conflictExecPlanAbsPath = path.resolve(
      workspace,
      conflictExecPlanPath
    );
    try {
      const dir = path.dirname(conflictExecPlanAbsPath);
      await fs.mkdir(dir, { recursive: true });
      try {
        await fs.access(conflictExecPlanAbsPath);
      } catch {
        const skeleton = generateConflictExecPlanSkeleton(
          runId,
          conflictScanResult
        );
        await Bun.write(conflictExecPlanAbsPath, skeleton);
      }

      const promptLines = [
        "You are a conflict analysis agent.",
        "",
        `ExecPlan path: ${conflictExecPlanPath}`,
        "",
        "Instructions:",
        "- Read the ExecPlan at the given path and the conflict summary.",
        "- Do NOT modify files or run git commands; stay analysis-only.",
        "- Describe the nature of the conflicts and propose safe resolution strategies.",
        "- Update the Progress and Decision Log as you reason.",
        "- Summarise your recommendations at the end.",
      ];
      const prompt = promptLines.join("\n");

      const startedAt = Date.now();
      const conflictEvents: WorkflowEvent[] = [];

      const writer = {
        write: async (chunk: unknown) => {
          const payload = chunk as { type?: string; event?: unknown };
          if (!payload || typeof payload !== "object") {
            return;
          }
          const type = (payload as any).type;
          if (type === "stdout" || type === "stderr") {
            const text = (payload as any).text ?? "";
            conflictEvents.push({ type, text } as any);
          } else if (type === "notice") {
            conflictEvents.push({
              type: "notice",
              message: (payload as any).message ?? "conflict_agent_notice",
            } as any);
          }
        },
      } as const;

      try {
        await toolCodex.execute({
          input: {
            action: "exec",
            prompt,
            out: "text",
            auto: "read", // Enforce read-only for analysis agents
            cw: workspace,
            containerName,
            containerCw,
            sessionId: `${runId}:conflict`,
            model: undefined,
            profile: undefined,
            authz,
            context: {},
            userId,
          },
          writer,
          signal,
        });

        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

        for (const ev of conflictEvents) {
          yield ev;
        }

        yield {
          type: "event",
          kind: "conflict-agent-result",
          data: {
            role: "conflict",
            status: "completed",
            durationSeconds,
          },
        } as any;
      } catch (error) {
        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
        const { userMessage, rawMessage, code, needsElevation, limitExceeded } =
          formatCodexRuntimeError(error);
        logger.warn("conflict_agent_execution_failed", {
          runId,
          error: rawMessage,
          code,
          needsElevation,
          limitExceeded,
        });
        conflictEvents.push({
          type: "notice",
          message: userMessage,
        } as any);
        for (const ev of conflictEvents) {
          yield ev;
        }
        yield {
          type: "event",
          kind: "conflict-agent-result",
          data: {
            role: "conflict",
            status: "failed",
            durationSeconds,
          },
        } as any;
      }
    } catch (error) {
      const { userMessage, rawMessage, code, needsElevation, limitExceeded } =
        formatCodexRuntimeError(error);
      logger.warn("conflict_agent_initialisation_failed", {
        runId,
        error: rawMessage,
        code,
        needsElevation,
        limitExceeded,
      });
      yield { type: "notice", message: userMessage } as any;
    }

    // Phase C: Conflict Resolution Agent
    // If we have conflicts, attempt to resolve them automatically
    if (
      conflictScanResult.totalMarkers > 0 &&
      (input.auto === "medium" || input.auto === "high")
    ) {
      yield { type: "notice", message: "conflict_resolution_started" } as any;

      const resolutionExecPlanPath = plansPath(
        workspace,
        runId,
        "conflict-resolution.md"
      );
      const resolutionExecPlanAbsPath = path.resolve(
        workspace,
        resolutionExecPlanPath
      );

      // Create a resolution plan skeleton if it doesn't exist
      try {
        const dir = path.dirname(resolutionExecPlanAbsPath);
        await fs.mkdir(dir, { recursive: true });

        const skeleton = [
          `# Conflict Resolution Plan for run ${runId}`,
          "",
          "## Purpose",
          "Resolve merge conflicts detected in the workspace.",
          "",
          "## Instructions",
          "- Use the analysis from `conflict.md` if available.",
          "- For each conflicted file, edit the file to remove conflict markers and choose/merge the correct content.",
          "- Verify the fix by running relevant tests if possible.",
          "",
          "## Progress",
          "- [ ] (pending) Resolution started.",
        ].join("\n");

        await Bun.write(resolutionExecPlanAbsPath, skeleton);
      } catch (_e) {
        // Ignore
      }

      const prompt = [
        "You are a conflict resolution agent.",
        `ExecPlan path: ${resolutionExecPlanPath}`,
        "Your goal is to RESOLVE the git merge conflicts in the workspace.",
        "1. Read the conflict analysis.",
        "2. Edit the files to resolve conflicts (choose 'current', 'incoming', or merge manually).",
        "3. Ensure no conflict markers remain.",
      ].join("\n");

      const startedAt = Date.now();
      const events: WorkflowEvent[] = [];

      const writer = {
        write: async (chunk: unknown) => {
          // Reuse standard writer logic
          const payload = chunk as any;
          if (payload?.type === "stdout" || payload?.type === "stderr") {
            events.push(payload);
          }
        },
      };

      try {
        await toolCodex.execute({
          input: {
            action: "exec",
            prompt,
            out: "text",
            auto: "medium", // Allow edits for resolution
            cw: workspace,
            containerName,
            containerCw,
            sessionId: `${runId}:conflict-resolve`,
            model: undefined,
            profile: undefined,
            authz,
            context: {},
            userId,
          },
          writer,
          signal,
        });

        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

        for (const ev of events) {
          yield ev;
        }

        yield {
          type: "event",
          kind: "conflict-resolution-result",
          data: {
            role: "conflict_resolver",
            status: "completed",
            durationSeconds,
          },
        } as any;
      } catch (error) {
        const finishedAt = Date.now();
        const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
        const { userMessage, rawMessage, code, needsElevation, limitExceeded } =
          formatCodexRuntimeError(error);
        logger.warn("conflict_resolution_failed", {
          runId,
          error: rawMessage,
          code,
          needsElevation,
          limitExceeded,
        });
        events.push({
          type: "notice",
          message: userMessage,
        } as any);

        yield {
          type: "event",
          kind: "conflict-resolution-result",
          data: {
            role: "conflict_resolver",
            status: "failed",
            durationSeconds,
          },
        } as any;
      }
    }
  }
}
