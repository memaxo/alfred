import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type {
  AgentOutcome,
  ExecuteOutput,
  FileChange,
  ScheduleOutput,
  SubTask,
} from "./types";

export class ExecuteStage
  implements PipelineStage<ScheduleOutput, ExecuteOutput>
{
  readonly name = "execute" as const;

  async execute(
    input: ScheduleOutput,
    ctx: PipelineContext
  ): Promise<ExecuteOutput> {
    const outcomes = new Map<string, AgentOutcome>();
    const fileChanges: FileChange[] = [];
    const handoffs: string[] = [];

    ctx.emit(
      createEvent("stage:progress", {
        stage: "execute",
        message: `Executing ${input.waves.length} waves with ${input.executionMode} mode`,
      })
    );

    // Import dynamically to avoid circular dependencies
    const { runAgent } = await import("@alfred/runtime/orchestrator/agent");
    const { buildAgentSpec } = await import(
      "@alfred/agent/orchestrator/multi/spawn"
    );
    const { AsyncQueue } = await import("@alfred/runtime/utils/concurrency");

    // Get subtasks and exec plans from context
    const subtasks = ctx.get<SubTask[]>("subtasks") ?? [];
    const subTaskById = new Map(subtasks.map((t) => [t.id, t]));
    const execPlans = ctx.get<Map<string, string>>("execPlans") ?? new Map();
    const rootExecPlanPath = ctx.get<string>("rootPlanPath") ?? "";
    const queue = new AsyncQueue();

    // Sequential execution for POC
    for (let waveIndex = 0; waveIndex < input.waves.length; waveIndex++) {
      const wave = input.waves[waveIndex];
      if (!wave) {
        continue;
      }

      ctx.emit(
        createEvent("stage:progress", {
          stage: "execute",
          message: `Starting wave ${waveIndex + 1}/${input.waves.length}`,
        })
      );

      for (const subTaskId of wave.agents) {
        const subtask = subTaskById.get(subTaskId);
        if (!subtask) {
          logger.warn("subtask_not_found", { subTaskId, runId: ctx.runId });
          continue;
        }

        // Build agent spec using actual function
        const agentSpec = buildAgentSpec(subtask, ctx.runId, ctx.workspace, {
          auto: "medium",
        });
        agentSpec.execPlanPath = execPlans.get(subtask.id) ?? "";

        ctx.emit(
          createEvent("agent:spawn", {
            agentId: agentSpec.agentId,
            taskId: agentSpec.subTaskId,
          })
        );

        try {
          const result = await runAgent({
            spec: agentSpec,
            phaseId: "execute",
            runId: ctx.runId,
            workspace: ctx.workspace,
            workspaceRoot: ctx.workspace,
            subTaskById,
            projectConfig: ctx.get("projectConfig") ?? null,
            activeWorkspaces: [],
            agentFileHints: new Map(),
            rootExecPlanPath,
            signal: ctx.signal,
            authz: ctx.get("authz"),
            userId: ctx.userId,
            trackerContextRef: { 
              current: {
                state: {
                  agents: {},
                  waves: {},
                },
                blockedBy: new Map(),
                dependsOn: new Map(),
                detectors: new Map(),
                options: {
                  noProgressMs: 60_000,
                  maxTransitions: 200,
                  similarityThreshold: 0.92,
                },
              },
            },
            queue: queue as unknown as import("@alfred/runtime/utils/concurrency").AsyncQueue<import("@alfred/type").WorkflowEvent>,
          });

          const outcome: AgentOutcome = {
            agentId: result.agentId,
            phaseId: result.phaseId,
            stuck: result.stuck,
            status: result.status,
            durationSeconds: result.durationSeconds,
            role: result.role,
            escalation: result.escalation,
            result: result.result,
          };

          outcomes.set(agentSpec.subTaskId, outcome);

          ctx.emit(
            createEvent("agent:complete", {
            agentId: agentSpec.agentId,
            outcome: {
              status: result.status as "success" | "failure" | "escalated" | "timeout",
              durationMs: result.durationSeconds * 1000,
              handoff: result.result?.summary,
              error: result.escalation,
            },
            })
          );

          // Collect handoff for next agent
          if (result.result?.summary) {
            handoffs.push(result.result.summary);
          }

          // Collect file changes
          if (result.result?.changes) {
            for (const change of result.result.changes) {
              fileChanges.push({
                path: change,
                action: "modify", // Simplified - actual detection would check git status
              });
            }
          }

          logger.info("agent_complete", {
            runId: ctx.runId,
            agentId: agentSpec.agentId,
            status: result.status,
            durationSeconds: result.durationSeconds,
          });
        } catch (error) {
          const outcome: AgentOutcome = {
            agentId: agentSpec.agentId,
            phaseId: "execute",
            stuck: false,
            status: "failure",
            durationSeconds: 0,
            role: "agent",
            escalation: error instanceof Error ? error.message : String(error),
          };

          outcomes.set(agentSpec.subTaskId, outcome);

          ctx.emit(
            createEvent("agent:complete", {
              agentId: agentSpec.agentId,
              outcome: {
                status: "failure",
                durationMs: 0,
                error: error instanceof Error ? error.message : String(error),
              },
            })
          );

          logger.error("agent_failed", {
            runId: ctx.runId,
            agentId: agentSpec.agentId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Store execute output in context for summarize stage
    const executeOutput = {
      outcomes,
      fileChanges,
      handoffs,
    };
    ctx.set("executeOutput", executeOutput);
    ctx.set("fileChanges", fileChanges);

    return executeOutput;
  }
}
