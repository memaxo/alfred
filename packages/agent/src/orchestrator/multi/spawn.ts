import { openDirectorySecure } from "../../security/filesystem.js";
import type { SubTask, SubTaskId } from "./decompose";
import { buildFixerSubTask } from "./review";

export type AgentId = string;

export type WaveId = string;

export type AgentSpec = {
  agentId: AgentId;
  subTaskId: SubTaskId;
  sessionId: string;
  workingDirectory: string;
  environment: "host" | "worktree" | "container"; // New field
  auto: "read" | "low" | "medium" | "high";
  mandateTDD?: boolean; // Phase 4: TDD
  model?: string;
  profile?: string;
  execPlanPath: string;
  context: {
    linearIssueId?: string;
    linearSessionId?: string;
    linearSpace?: string;
    linearAuthz?: string;
    relevantFiles?: string[];
  };
};

export type WavePlan = {
  id: WaveId;
  agents: SubTaskId[];
  dependsOn: WaveId[];
};

function determineEnvironment(
  _subTask: SubTask,
  options?: { maxParallel?: number }
): "host" | "worktree" | "container" {
  // Phase 11: Docker Support
  // Use container for high risk tasks or explicit request
  // For now, we don't have risk analysis in SubTask yet, so we stick to worktree/host default.
  // But we allow override via options/env if we want to test it.
  if (process.env.ORCH_USE_CONTAINERS === "1") {
    return "container";
  }

  // Simple heuristic:
  // If we run >1 agent in parallel, use worktrees to avoid file contention.
  // If priority is 1 (backend/core), maybe host is fine if it's the only one?
  // Safest default for multi-agent is worktree.

  if ((options?.maxParallel ?? 1) > 1) {
    return "worktree";
  }
  return "host";
}

export function buildAgentSpec(
  subTask: SubTask,
  runId: string,
  cwd: string,
  options?: {
    auto?: "read" | "low" | "medium" | "high";
    model?: string;
    profile?: string;
    maxParallel?: number; // Added
    mandateTDD?: boolean; // Phase 4
    linear?: {
      issueId?: string;
      sessionId?: string;
      space?: string;
      authz?: string;
    };
  }
): AgentSpec {
  const auto = options?.auto ?? "low";
  const agentId: AgentId = `${runId}:${subTask.id}`;
  const sessionId = agentId;

  // Environment determination
  const environment = determineEnvironment(subTask, options);

  // NOTE: The workingDirectory here is the *base*.
  // The runtime will append the worktree path if environment is worktree.
  // But AgentSpec typically carries the *actual* cwd the agent should use.
  // We will let the runtime resolve the final path because it manages the worktree creation.
  // So we keep 'cwd' as the repo root here, and the runtime handles the switch?
  // Or we assume the runtime will mutate it.
  // Let's keep cwd as repo root, and let environment flag dictate behavior in core.ts.

  const dirHandle = openDirectorySecure(cwd);
  const workingDirectory = dirHandle.path;
  dirHandle.close();
  const execPlanPath = `.agent/plans/${runId}/${subTask.id}.md`;

  // Phase 8: Escalation Signal
  // const _escalationPrompt =
  //   "\n\nIf you encounter a blocking issue that prevents you from completing the task (e.g., missing dependencies, API key issues, architectural flaws), CREATE a file named 'ESCALATION.md' in your working directory describing the problem, and then EXIT with code 0.";

  return {
    agentId,
    subTaskId: subTask.id,
    sessionId,
    workingDirectory,
    environment,
    auto,
    mandateTDD: options?.mandateTDD,
    model: options?.model,
    profile: options?.profile,
    execPlanPath,
    context: {
      linearIssueId: options?.linear?.issueId,
      linearSessionId: options?.linear?.sessionId,
      linearSpace: options?.linear?.space,
      linearAuthz: options?.linear?.authz,
      relevantFiles: subTask.filesHint,
    },
    // We don't have a 'prompt' field in AgentSpec directly, it's constructed in waves.ts.
    // Wait, AgentSpec is just config. The prompt is built in runWaves.
    // So we shouldn't add it here, or we should add a field for 'additionalInstructions'.
    // But AgentSpec doesn't have it.
    // I should update runWaves to include this instruction.
  };
}

export function buildFixerAgentSpec(args: {
  runId: string;
  cwd: string;
  attempt: number;
  summary?: string;
  relevantFiles?: string[];
  auto?: "read" | "low" | "medium" | "high";
  linear?: {
    issueId?: string;
    sessionId?: string;
    space?: string;
    authz?: string;
  };
}): AgentSpec {
  const subTask = buildFixerSubTask({
    attempt: args.attempt,
    summary: args.summary,
    relevantFiles: args.relevantFiles,
  });

  const effectiveAuto =
    args.auto && args.auto !== "read" ? args.auto : "medium";

  return buildAgentSpec(subTask, args.runId, args.cwd, {
    auto: effectiveAuto,
    linear: args.linear,
  });
}

export function planWaves(
  subTasks: SubTask[],
  options?: { maxParallel?: number }
): WavePlan[] {
  const maxParallel = Math.max(1, options?.maxParallel ?? 2);
  if (subTasks.length === 0) {
    return [];
  }

  const byId = new Map<SubTaskId, SubTask>();
  for (const task of subTasks) {
    byId.set(task.id, task);
  }

  const graph = buildDepGraph(subTasks);
  const inDegree = computeInDegree(graph);

  const ready: SubTaskId[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      ready.push(id);
    }
  }

  // Stable order: higher priority first, then id.
  const sortReady = () => {
    ready.sort((a, b) => {
      const ta = byId.get(a);
      const tb = byId.get(b);
      if (!(ta && tb)) {
        return 0;
      }
      const diff = (tb.priority ?? 0) - (ta.priority ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return a.localeCompare(b);
    });
  };

  sortReady();

  const waves: WavePlan[] = [];
  const scheduled = new Set<SubTaskId>();

  let waveIndex = 0;
  while (ready.length > 0) {
    const currentWaveTasks: SubTaskId[] = [];
    while (ready.length > 0 && currentWaveTasks.length < maxParallel) {
      const id = ready.shift();
      if (!id) {
        break;
      }
      if (scheduled.has(id)) {
        continue;
      }
      currentWaveTasks.push(id);
      scheduled.add(id);
    }

    if (currentWaveTasks.length === 0) {
      break;
    }

    const waveId = `wave_${waveIndex}`;
    const dependsOn: WaveId[] = [];
    for (const taskId of currentWaveTasks) {
      const deps = graph.get(taskId);
      if (!deps) {
        continue;
      }
      for (const dep of deps) {
        const depWave = waves.find((w) => w.agents.includes(dep));
        if (
          depWave &&
          depWave.id !== waveId &&
          !dependsOn.includes(depWave.id)
        ) {
          dependsOn.push(depWave.id);
        }
      }
    }

    waves.push({ id: waveId, agents: currentWaveTasks, dependsOn });
    waveIndex += 1;

    // Decrement in-degree for neighbours whose deps are now satisfied.
    for (const taskId of currentWaveTasks) {
      for (const [node, deps] of graph.entries()) {
        if (deps.has(taskId)) {
          deps.delete(taskId);
          const degree = deps.size;
          if (degree === 0 && !scheduled.has(node)) {
            ready.push(node);
          }
        }
      }
    }

    sortReady();
  }

  if (scheduled.size !== byId.size) {
    // Cycles or missing nodes; fall back to single wave preserving priority.
    const remaining: SubTaskId[] = [];
    for (const [id] of byId.entries()) {
      if (!scheduled.has(id)) {
        remaining.push(id);
      }
    }
    remaining.sort((a, b) => {
      const ta = byId.get(a);
      const tb = byId.get(b);
      if (!(ta && tb)) {
        return 0;
      }
      const diff = (tb.priority ?? 0) - (ta.priority ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return a.localeCompare(b);
    });
    if (remaining.length > 0) {
      waves.push({ id: `wave_${waveIndex}`, agents: remaining, dependsOn: [] });
    }
  }

  return waves;
}

function buildDepGraph(subTasks: SubTask[]): Map<SubTaskId, Set<SubTaskId>> {
  const graph = new Map<SubTaskId, Set<SubTaskId>>();
  for (const task of subTasks) {
    graph.set(task.id, new Set(task.deps));
  }
  return graph;
}

function computeInDegree(
  graph: Map<SubTaskId, Set<SubTaskId>>
): Map<SubTaskId, number> {
  const inDegree = new Map<SubTaskId, number>();
  for (const [task, deps] of graph.entries()) {
    inDegree.set(task, deps.size);
  }
  return inDegree;
}

export const __internals = {
  buildDepGraph,
  computeInDegree,
};
