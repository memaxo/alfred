import * as workflowRepo from "@alfred/db/repo/workflow";
import { TRPCError } from "@trpc/server";
import { type LanguageModel, stepCountIs } from "ai";
import { z } from "zod";
import { generateText, persistResult } from "../ai/generate";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { requirePolicy } from "../gate";
import {
  orchestratorGenerateDurationSeconds,
  orchestratorGenerateRequestsTotal,
} from "../metrics";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { sanitizeResult } from "../utils/generate";

const ORCHESTRATOR_MAX_STEPS = 12;

const generateInput = z.object({
  thread: z.string().optional(),
  resource: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
  maxSteps: z.number().int().min(1).max(ORCHESTRATOR_MAX_STEPS).optional(),
  memory: z.unknown().optional(),
});

function mapResource(raw: unknown) {
  const input = (raw ?? {}) as z.infer<typeof generateInput> & {
    requirement?: string;
  };
  return {
    kind: "orchestrator" as const,
    id: input.thread ?? input.resource ?? "default",
    attrs: {
      scope: input.resource ?? "self",
    },
  };
}

export const orchestratorRouter = router({
  generate: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("orchestrator.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const stopTimer = orchestratorGenerateDurationSeconds.startTimer();
      orchestratorGenerateRequestsTotal.inc({ status: "started" });
      try {
        const { getOrchestratorAgentDefaults } = await import(
          "@alfred/agent/agents"
        );
        const defaults = getOrchestratorAgentDefaults();
        const model = defaults.model as LanguageModel;
        const system =
          typeof defaults.instructions === "string"
            ? defaults.instructions
            : JSON.stringify(defaults.instructions);
        const modelMessages = await prepareModelMessagesForGenerate({
          rawMessages: input.messages,
          tools: defaults.tools,
          source: "orchestrator",
          model,
          system,
        });
        const stopWhen =
          typeof input.maxSteps === "number"
            ? stepCountIs(input.maxSteps)
            : defaults.stopWhen;

        const result = await generateText({
          ...defaults,
          model,
          messages: modelMessages,
          toolChoice: input.toolChoice,
          stopWhen,
        });
        const output = sanitizeResult(result);
        const replayId = await persistResult({
          userId: ctx.session.user.id,
          kind: "orchestrator",
          input,
          result: output,
        });
        orchestratorGenerateRequestsTotal.inc({ status: "success" });
        stopTimer({ status: "success" });
        return {
          ...output,
          replayId: replayId ?? undefined,
        } as typeof output & {
          replayId?: string;
        };
      } catch (error) {
        orchestratorGenerateRequestsTotal.inc({ status: "error" });
        stopTimer({ status: "error" });
        throw toTRPCError(error, "orchestrator_error");
      }
    }),
  stream: authedProcedure
    // Streaming moved to HTTP SSE to keep a single transport.
    .input(z.object({}).passthrough())
    .subscription(() => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message:
          "orchestrator.stream has moved to the HTTP SSE endpoint at /api/orchestrator.",
      });
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Runs Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  runsList: authedProcedure
    .input(
      z.object({
        status: z
          .enum(["running", "suspended", "completed", "failed", "cancelled"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const runs = await workflowRepo.listRuns({
        userId: ctx.session.user.id,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      });

      // Compute wave information for each run from events
      const runsWithWaves = await Promise.all(
        runs.map(async (run) => {
          const events = await workflowRepo.listEvents(run.id);
          const waves = computeWavesFromEvents(events, run.status);
          const agents = computeAgentsFromEvents(events);
          return {
            id: run.id,
            workflowId: run.workflowId,
            requirement: run.requirement,
            status: run.status,
            created: run.created?.toISOString() ?? new Date().toISOString(),
            waves,
            agents,
            agentCount: agents.length,
            progress: computeOverallProgress(waves),
          };
        })
      );

      return { runs: runsWithWaves };
    }),

  runsGet: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }

      const events = await workflowRepo.listEvents(run.id);
      const waves = computeWavesFromEvents(events, run.status);
      const agents = computeAgentsFromEvents(events);

      return {
        id: run.id,
        workflowId: run.workflowId,
        requirement: run.requirement,
        status: run.status,
        created: run.created?.toISOString() ?? new Date().toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        errorMessage: run.errorMessage ?? null,
        waves,
        agents,
        progress: computeOverallProgress(waves),
      };
    }),

  runsPause: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.status !== "running") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "run_not_running",
        });
      }
      await workflowRepo.updateRun(input.runId, {
        status: "suspended",
        suspendedAt: new Date(),
      });
      return { success: true };
    }),

  runsResume: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.status !== "suspended") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "run_not_suspended",
        });
      }
      await workflowRepo.updateRun(input.runId, {
        status: "running",
        resumedAt: new Date(),
      });
      return { success: true };
    }),

  runsCancel: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.status === "completed" || run.status === "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "run_already_finished",
        });
      }
      await workflowRepo.updateRun(input.runId, {
        status: "cancelled",
        completedAt: new Date(),
      });
      return { success: true };
    }),

  logsStream: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
        agentId: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }

      const events = await workflowRepo.listEvents(input.runId);

      // Transform events into log entries
      const logs = events
        .filter((e) => {
          // Filter by agentId if provided
          if (input.agentId) {
            const data = e.eventData as Record<string, unknown> | null;
            return data?.agentId === input.agentId;
          }
          return true;
        })
        .slice(0, input.limit)
        .map((e) => {
          const data = e.eventData as Record<string, unknown> | null;
          return {
            id: e.eventId,
            timestamp: e.timestamp?.toISOString() ?? new Date().toISOString(),
            type: mapEventTypeToLogLevel(e.eventType, data),
            agentId: (data?.agentId as string) ?? null,
            message: formatEventMessage(e.eventType, data),
            metadata: data,
          };
        });

      return { logs };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

type AgentStatus = "pending" | "spawning" | "running" | "completed" | "failed";

type ComputedAgent = {
  id: string;
  name: string;
  type: "codex" | "droid" | "claude" | "roo";
  status: AgentStatus;
  progress: number;
  wave: number;
  parentId?: string;
  output?: string;
};

type ComputedWave = {
  id: number;
  status: "pending" | "running" | "completed";
  agents: string[];
  startTime?: string;
  endTime?: string;
};

function computeWavesFromEvents(
  events: Awaited<ReturnType<typeof workflowRepo.listEvents>>,
  runStatus: string
): ComputedWave[] {
  // Extract wave information from events with agent data
  // Look for agent info in eventData regardless of event type
  const agentWaves = new Map<string, number>();
  const waveAgents = new Map<number, string[]>();
  const waveStarts = new Map<number, Date>();
  const waveEnds = new Map<number, Date>();

  for (const event of events) {
    const data = event.eventData as Record<string, unknown> | null;
    if (!data) continue;

    const agentId = data.agentId as string | undefined;
    const agentEvent = data.event as string | undefined;

    // Check for agent spawn events (stored in eventData.event or inferred from droid type)
    if ((agentEvent === "spawn" || event.eventType === "droid") && agentId) {
      const wave = (data.wave as number) ?? 1;
      agentWaves.set(agentId, wave);

      const existing = waveAgents.get(wave) ?? [];
      if (!existing.includes(agentId)) {
        existing.push(agentId);
        waveAgents.set(wave, existing);
      }

      if (!waveStarts.has(wave) && event.timestamp) {
        waveStarts.set(wave, event.timestamp);
      }
    }

    // Check for agent completion events
    if ((agentEvent === "complete" || data.status === "completed") && agentId) {
      const wave = agentWaves.get(agentId);
      if (wave !== undefined && event.timestamp) {
        const existingEnd = waveEnds.get(wave);
        if (!existingEnd || event.timestamp > existingEnd) {
          waveEnds.set(wave, event.timestamp);
        }
      }
    }
  }

  // If no waves found, create a default wave
  if (waveAgents.size === 0) {
    return [
      {
        id: 1,
        status:
          runStatus === "running"
            ? "running"
            : runStatus === "completed"
              ? "completed"
              : "pending",
        agents: [],
      },
    ];
  }

  // Build waves array
  const maxWave = Math.max(...waveAgents.keys());
  const waves: ComputedWave[] = [];

  for (let i = 1; i <= maxWave; i++) {
    const agents = waveAgents.get(i) ?? [];
    const startTime = waveStarts.get(i);
    const endTime = waveEnds.get(i);

    let status: "pending" | "running" | "completed" = "pending";
    if (endTime) {
      status = "completed";
    } else if (startTime) {
      status = "running";
    }

    waves.push({
      id: i,
      status,
      agents,
      startTime: startTime?.toISOString(),
      endTime: endTime?.toISOString(),
    });
  }

  return waves;
}

function computeAgentsFromEvents(
  events: Awaited<ReturnType<typeof workflowRepo.listEvents>>
): ComputedAgent[] {
  const agents = new Map<string, ComputedAgent>();

  for (const event of events) {
    const data = event.eventData as Record<string, unknown> | null;
    if (!data) continue;

    const agentId = data.agentId as string | undefined;
    if (!agentId) continue;

    const agentEvent = data.event as string | undefined;

    // Check for agent spawn events
    if (
      (agentEvent === "spawn" || event.eventType === "droid") &&
      !agents.has(agentId)
    ) {
      agents.set(agentId, {
        id: agentId,
        name: (data.name as string) ?? agentId.slice(0, 8),
        type: (data.type as ComputedAgent["type"]) ?? "codex",
        status: "spawning",
        progress: 0,
        wave: (data.wave as number) ?? 1,
        parentId: data.parentId as string | undefined,
      });
    }

    // Check for progress updates
    if (agentEvent === "progress" || event.eventType === "progress") {
      const existing = agents.get(agentId);
      if (existing) {
        existing.status = "running";
        existing.progress = (data.progress as number) ?? existing.progress;
      }
    }

    // Check for agent completion
    if (agentEvent === "complete" || data.status === "completed") {
      const existing = agents.get(agentId);
      if (existing) {
        existing.status = "completed";
        existing.progress = 100;
        existing.output = data.output as string | undefined;
      }
    }

    // Check for agent errors
    if (agentEvent === "error" || event.eventType === "error") {
      const existing = agents.get(agentId);
      if (existing) {
        existing.status = "failed";
      }
    }
  }

  return Array.from(agents.values());
}

function computeOverallProgress(waves: ComputedWave[]): number {
  if (waves.length === 0) return 0;
  const completedWaves = waves.filter((w) => w.status === "completed").length;
  const runningWaves = waves.filter((w) => w.status === "running").length;
  return Math.round(
    ((completedWaves + runningWaves * 0.5) / waves.length) * 100
  );
}

function mapEventTypeToLogLevel(
  eventType: string,
  data: Record<string, unknown> | null
): "info" | "warning" | "error" | "success" {
  // Check eventData.event for more specific event types
  const agentEvent = data?.event as string | undefined;
  const status = data?.status as string | undefined;

  if (agentEvent === "complete" || status === "completed") {
    return "success";
  }
  if (eventType === "error" || agentEvent === "error") {
    return "error";
  }
  if (eventType === "notice") {
    return "warning";
  }
  return "info";
}

function formatEventMessage(
  eventType: string,
  data: Record<string, unknown> | null
): string {
  if (!data) return eventType;

  const agentEvent = data.event as string | undefined;
  const agentId = data.agentId as string | undefined;

  // Format based on eventData.event if present
  if (agentEvent) {
    switch (agentEvent) {
      case "spawn":
        return `Agent ${data.name ?? agentId} spawned (wave ${data.wave ?? 1})`;
      case "progress":
        return `Agent ${agentId} progress: ${data.progress ?? 0}%`;
      case "complete":
        return `Agent ${agentId} completed`;
      case "error":
        return `Agent ${agentId} error: ${data.error ?? "unknown"}`;
    }
  }

  // Format based on eventType
  switch (eventType) {
    case "run":
      return "Workflow started";
    case "progress":
      return (data.message as string) ?? `Progress: ${data.progress ?? 0}%`;
    case "stdout":
      return (data.text as string) ?? "Output";
    case "stderr":
      return (data.text as string) ?? "Error output";
    case "droid":
      return `Droid: ${data.name ?? agentId ?? "agent"}`;
    case "notice":
      return (data.message as string) ?? "Notice";
    case "error":
      return (data.message as string) ?? (data.error as string) ?? "Error";
    case "ui-message":
      return "UI message";
    case "text-delta":
      return (data.text as string) ?? "Text delta";
    case "tool-call":
      return `Tool: ${data.toolName ?? "unknown"}`;
    default:
      return (data.message as string) ?? eventType;
  }
}
