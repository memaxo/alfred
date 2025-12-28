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
  agentType?: string; // New: Agent role (e.g. codex, research)
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
    handoff?: string; // New: Textual handoff from previous wave
    clarifications?: Array<{ response: string }>; // New: User clarifications
  };
};

export type WavePlan = {
  id: WaveId;
  agents: SubTaskId[];
  dependsOn: WaveId[];
  agentType?: string;
  isolation?: "container" | "worktree";
  phaseId?: string;
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
  if (
    feature("LEGACY_POOF") &&
    process.env.ORCH_USE_POOF === "1" &&
    process.platform === "linux"
  ) {
    return "poof";
  }

  // Feature-flagged legacy path: git worktree isolation
  if (feature("LEGACY_WORKTREE") && process.env.ORCH_USE_WORKTREE === "1") {
    return "worktree";
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
    agentType?: string;
    profile?: string;
    poofProfile?: PoofProfileName; // Resource profile for poof isolation (legacy)
    maxParallel?: number;
    mandateTDD?: boolean; // Phase 4
    handoff?: string;
    clarifications?: Array<{ response: string }>;
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
    agentType: options?.agentType,
    profile: options?.profile,
    poofProfile: options?.poofProfile,
    execPlanPath,
    context: {
      linearIssueId: options?.linear?.issueId,
      linearSessionId: options?.linear?.sessionId,
      linearSpace: options?.linear?.space,
      linearAuthz: options?.linear?.authz,
      relevantFiles: subTask.filesHint,
      handoff: options?.handoff,
      clarifications: options?.clarifications,
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
  options?: {
    maxParallel?: number;
    dependencies?: Map<SubTaskId, SubTaskId[]>;
  }
): WavePlan[] {
  const maxParallel = Math.max(1, options?.maxParallel ?? 2);
  if (subTasks.length === 0) {
    return [];
  }

  const byId = new Map<SubTaskId, SubTask>();
  for (const task of subTasks) {
    byId.set(task.id, task);
  }

  // Build immutable copy of deps and reverse adjacency list
  const deps = new Map<SubTaskId, Set<SubTaskId>>();
  const dependents = new Map<SubTaskId, SubTaskId[]>();
  const inDegree = new Map<SubTaskId, number>();

  for (const task of subTasks) {
    const taskDeps = options?.dependencies?.get(task.id) ?? task.deps;
    deps.set(task.id, new Set(taskDeps));
    inDegree.set(task.id, taskDeps.length);
    if (!dependents.has(task.id)) {
      dependents.set(task.id, []);
    }
    for (const dep of taskDeps) {
      const list = dependents.get(dep) ?? [];
      list.push(task.id);
      dependents.set(dep, list);
    }
  }

  // Comparator for stable priority ordering
  const compareTasks = (a: SubTaskId, b: SubTaskId): number => {
    const ta = byId.get(a);
    const tb = byId.get(b);
    if (!(ta && tb)) {
      return 0;
    }
    const diff = (tb.priority ?? 0) - (ta.priority ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  };

  // Initialize ready queue with zero in-degree tasks
  let readyQueue: SubTaskId[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      readyQueue.push(id);
    }
  }
  readyQueue.sort(compareTasks);

  const waves: WavePlan[] = [];
  const scheduled = new Set<SubTaskId>();
  const taskToWave = new Map<SubTaskId, WaveId>();

  let waveIndex = 0;
  let readyIndex = 0;

  while (readyIndex < readyQueue.length) {
    const currentWaveTasks: SubTaskId[] = [];

    // Collect up to maxParallel tasks from current ready queue
    while (
      readyIndex < readyQueue.length &&
      currentWaveTasks.length < maxParallel
    ) {
      const id = readyQueue[readyIndex++];
      if (id === undefined || scheduled.has(id)) {
        continue;
      }
      currentWaveTasks.push(id);
      scheduled.add(id);
    }

    if (currentWaveTasks.length === 0) {
      break;
    }

    const waveId = `wave_${waveIndex}`;

    // Compute wave dependencies using original deps (immutable)
    const dependsOnSet = new Set<WaveId>();
    for (const taskId of currentWaveTasks) {
      taskToWave.set(taskId, waveId);
      const taskDeps = deps.get(taskId);
      if (!taskDeps) {
        continue;
      }
      for (const dep of taskDeps) {
        const depWave = taskToWave.get(dep);
        if (depWave && depWave !== waveId) {
          dependsOnSet.add(depWave);
        }
      }
    }

    waves.push({
      id: waveId,
      agents: currentWaveTasks,
      dependsOn: Array.from(dependsOnSet),
    });
    waveIndex++;

    // Collect newly ready tasks using reverse adjacency
    const newReady: SubTaskId[] = [];
    for (const taskId of currentWaveTasks) {
      const taskDependents = dependents.get(taskId) ?? [];
      for (const dependent of taskDependents) {
        const degree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, degree);
        if (degree === 0 && !scheduled.has(dependent)) {
          newReady.push(dependent);
        }
      }
    }

    // Rebuild ready queue with remaining + new items
    if (newReady.length > 0 || readyIndex < readyQueue.length) {
      const remaining = readyQueue
        .slice(readyIndex)
        .filter((id) => !scheduled.has(id));
      readyQueue = [...remaining, ...newReady].sort(compareTasks);
      readyIndex = 0;
    }
  }

  // Handle cycles or missing nodes
  if (scheduled.size !== byId.size) {
    const remaining: SubTaskId[] = [];
    for (const [id] of byId.entries()) {
      if (!scheduled.has(id)) {
        remaining.push(id);
      }
    }
    remaining.sort(compareTasks);
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
