import type { SubTask, SubTaskId } from "./decompose";

export type AgentId = string;

export type WaveId = string;

export type AgentSpec = {
  agentId: AgentId;
  subTaskId: SubTaskId;
  sessionId: string;
  workingDirectory: string;
  environment: "host" | "worktree" | "container"; // New field
  auto: "read" | "low" | "medium" | "high";
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

function determineEnvironment(subTask: SubTask, options?: { maxParallel?: number }): "host" | "worktree" {
  // Simple heuristic:
  // If we run >1 agent in parallel, use worktrees to avoid file contention.
  // If priority is 1 (backend/core), maybe host is fine if it's the only one?
  // Safest default for multi-agent is worktree.
  // But for "Act" phase we might default to worktree.
  
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
  
  const workingDirectory = cwd;
  const execPlanPath = `.agent/plans/${runId}/${subTask.id}.md`;

  return {
    agentId,
    subTaskId: subTask.id,
    sessionId,
    workingDirectory,
    environment,
    auto,
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
  };
}

export function planWaves(
  subTasks: SubTask[],
  options?: { maxParallel?: number }
): WavePlan[] {
  const maxParallel = Math.max(1, options?.maxParallel ?? 2);
  if (subTasks.length === 0) return [];

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
      const ta = byId.get(a)!;
      const tb = byId.get(b)!;
      const diff = (tb.priority ?? 0) - (ta.priority ?? 0);
      if (diff !== 0) return diff;
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
      if (!id) break;
      if (scheduled.has(id)) continue;
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
      if (!deps) continue;
      for (const dep of deps) {
        const depWave = waves.find((w) => w.agents.includes(dep));
        if (depWave && depWave.id !== waveId && !dependsOn.includes(depWave.id)) {
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
      const ta = byId.get(a)!;
      const tb = byId.get(b)!;
      const diff = (tb.priority ?? 0) - (ta.priority ?? 0);
      if (diff !== 0) return diff;
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

function computeInDegree(graph: Map<SubTaskId, Set<SubTaskId>>): Map<SubTaskId, number> {
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
