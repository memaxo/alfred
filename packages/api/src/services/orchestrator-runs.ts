import * as workflowRepo from "@alfred/db/repo/workflow";
import { TRPCError } from "@trpc/server";

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

type RunWithDetails = {
  id: string;
  workflowId: string;
  requirement: string;
  status: string;
  created: string;
  completedAt: string | null;
  errorMessage: string | null;
  waves: ComputedWave[];
  agents: ComputedAgent[];
  progress: number;
};

type RunListItem = {
  id: string;
  workflowId: string;
  requirement: string;
  status: string;
  created: string;
  waves: ComputedWave[];
  agents: ComputedAgent[];
  agentCount: number;
  progress: number;
};

type LogEntry = {
  id: string;
  timestamp: string;
  type: "info" | "warning" | "error" | "success";
  agentId: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Orchestrator runs domain service
 *
 * Extracts run management logic from orchestrator router to keep routers thin.
 * Handles run listing, retrieval, pause/resume/cancel, and log streaming.
 */

function computeWavesFromEvents(
  events: Awaited<ReturnType<typeof workflowRepo.listEvents>>,
  runStatus: string
): ComputedWave[] {
  const agentWaves = new Map<string, number>();
  const waveAgents = new Map<number, string[]>();
  const waveStarts = new Map<number, Date>();
  const waveEnds = new Map<number, Date>();

  for (const event of events) {
    const data = event.eventData as Record<string, unknown> | null;
    if (!data) {
      continue;
    }

    const agentId = data.agentId as string | undefined;
    const agentEvent = data.event as string | undefined;

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

  const maxWave = Math.max(...waveAgents.keys());
  const waves: ComputedWave[] = [];

  for (let i = 1; i <= maxWave; i++) {
    const agents = waveAgents.get(i) ?? [];
    const startTime = waveStarts.get(i);
    const endTime = waveEnds.get(i);

    let status: ComputedWave["status"] = "pending";
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
    if (!data) {
      continue;
    }

    const agentId = data.agentId as string | undefined;
    if (!agentId) {
      continue;
    }

    const agentEvent = data.event as string | undefined;

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

    if (agentEvent === "progress" || event.eventType === "progress") {
      const existing = agents.get(agentId);
      if (existing) {
        existing.status = "running";
        existing.progress = (data.progress as number) ?? existing.progress;
      }
    }

    if (agentEvent === "complete" || data.status === "completed") {
      const existing = agents.get(agentId);
      if (existing) {
        existing.status = "completed";
        existing.progress = 100;
        existing.output = data.output as string | undefined;
      }
    }

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
  if (waves.length === 0) {
    return 0;
  }
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
  if (!data) {
    return eventType;
  }

  const agentEvent = data.event as string | undefined;
  const agentId = data.agentId as string | undefined;

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

export async function listRunsWithDetails(input: {
  userId: string;
  status?: "running" | "suspended" | "completed" | "failed" | "cancelled";
  limit: number;
  offset: number;
}): Promise<{ runs: RunListItem[] }> {
  const runs = await workflowRepo.listRuns({
    userId: input.userId,
    status: input.status,
    limit: input.limit,
    offset: input.offset,
  });

  const runsWithWaves = await Promise.all(
    runs.map(async (run) => {
      const events = await workflowRepo.listEvents(run.id);
      const waves = computeWavesFromEvents(events, run.status);
      const agents = computeAgentsFromEvents(events);
      return {
        id: run.id,
        workflowId: run.workflowId,
        requirement: run.requirement ?? "",
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
}

export async function getRunWithDetails(input: {
  runId: string;
  userId: string;
}): Promise<RunWithDetails> {
  const run = await workflowRepo.getRun(input.runId);
  if (!run || run.userId !== input.userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
  }

  const events = await workflowRepo.listEvents(run.id);
  const waves = computeWavesFromEvents(events, run.status);
  const agents = computeAgentsFromEvents(events);

  return {
    id: run.id,
    workflowId: run.workflowId,
    requirement: run.requirement ?? "",
    status: run.status,
    created: run.created?.toISOString() ?? new Date().toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage ?? null,
    waves,
    agents,
    progress: computeOverallProgress(waves),
  };
}

export async function streamRunLogs(input: {
  runId: string;
  userId: string;
  agentId?: string;
  limit: number;
}): Promise<{ logs: LogEntry[] }> {
  const run = await workflowRepo.getRun(input.runId);
  if (!run || run.userId !== input.userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
  }

  const events = await workflowRepo.listEvents(input.runId);

  const logs = events
    .filter((e) => {
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
}
