import { feature } from "bun:bundle";
import type { WorkspaceKind } from "../../environment/types.js";
import { openDirectorySecure } from "../../security/filesystem.js";
import type { SubTask, SubTaskId } from "./decompose";
import { buildFixerSubTask } from "./review";

export type AgentId = string;

export type WaveId = string;

/**
 * Poof profile name type (legacy).
 * Only used when built with --feature=LEGACY_POOF.
 */
type PoofProfileName = "minimal" | "standard" | "intensive";

export type AgentSpec = {
  agentId: AgentId;
  subTaskId: SubTaskId;
  sessionId: string;
  workingDirectory: string;
  environment: WorkspaceKind;
  auto: "read" | "low" | "medium" | "high";
  mandateTDD?: boolean; // Phase 4: TDD
  model?: string;
  profile?: string;
  /** Resource profile for poof isolation (legacy, only with --feature=LEGACY_POOF) */
  poofProfile?: PoofProfileName;
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

/**
 * Determine the execution environment for an agent.
 *
 * Production builds always use Docker containers.
 * Development builds with feature flags can use legacy isolation methods.
 */
function determineEnvironment(
  _subTask: SubTask,
  _options?: { maxParallel?: number; useIsolation?: boolean }
): WorkspaceKind {
  // Feature-flagged legacy path: poof isolation (Linux only)
  if (feature("LEGACY_POOF")) {
    if (process.env.ORCH_USE_POOF === "1" && process.platform === "linux") {
      return "poof";
    }
  }

  // Feature-flagged legacy path: git worktree isolation
  if (feature("LEGACY_WORKTREE")) {
    if (process.env.ORCH_USE_WORKTREE === "1") {
      return "worktree";
    }
  }

  // Production default: Docker container isolation
  return "container";
}

export function buildAgentSpec(
  subTask: SubTask,
  runId: string,
  cwd: string,
  options?: {
    auto?: "read" | "low" | "medium" | "high";
    model?: string;
    profile?: string;
    poofProfile?: PoofProfileName; // Resource profile for poof isolation (legacy)
    maxParallel?: number;
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

  // Environment determination - always "container" in production
  const environment = determineEnvironment(subTask, options);

  // `cwd` is provided by the orchestrator/runtime as the workspace root for this run.
  // Default `openDirectorySecure()` prefixes are anchored to `process.cwd()`, which
  // breaks when the workflow runtime executes in a sandbox/tmp workspace (tests, fixtures).
  // Treat the passed `cwd` as the allowed root for this agent spec.
  const dirHandle = openDirectorySecure(cwd, { allowedPrefixes: [cwd] });
  const workingDirectory = dirHandle.path;
  dirHandle.close();
  const execPlanPath = `.agent/plans/${runId}/${subTask.id}.md`;

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
    poofProfile: options?.poofProfile,
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
