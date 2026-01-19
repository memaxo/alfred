/**
 * Plan Editor Hook
 *
 * Provides state management and actions for editing workflow plans.
 * Supports undo/redo, validation, and wave regeneration.
 */

import type {
  PlanPhaseOutput,
  SubTask,
  WavePlan,
} from "@alfred/pipeline/schemas";
import { useCallback, useMemo, useState } from "react";

export type PlanEditorState = {
  plan: PlanPhaseOutput;
  modified: boolean;
  undoStack: PlanPhaseOutput[];
  redoStack: PlanPhaseOutput[];
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
};

export type PlanEditorActions = {
  reorderTask: (taskId: string, newIndex: number) => void;
  updateTask: (taskId: string, updates: Partial<SubTask>) => void;
  removeTask: (taskId: string) => void;
  addTask: (task: SubTask, afterTaskId?: string) => void;
  moveTaskToWave: (taskId: string, waveId: string) => void;
  regenerateWaves: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  save: () => Promise<void>;
};

export type UsePlanEditorReturn = {
  state: PlanEditorState;
  actions: PlanEditorActions;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * Hook for editing workflow plans with undo/redo and validation.
 */
export function usePlanEditor(
  initialPlan: PlanPhaseOutput,
  onSave?: (plan: PlanPhaseOutput) => Promise<void>
): UsePlanEditorReturn {
  const [currentPlan, setCurrentPlan] = useState<PlanPhaseOutput>(initialPlan);
  const [undoStack, setUndoStack] = useState<PlanPhaseOutput[]>([]);
  const [redoStack, setRedoStack] = useState<PlanPhaseOutput[]>([]);

  // Track if plan has been modified
  const modified = useMemo(
    () => JSON.stringify(currentPlan) !== JSON.stringify(initialPlan),
    [currentPlan, initialPlan]
  );

  // Validate current plan
  const validation = useMemo(() => validatePlan(currentPlan), [currentPlan]);

  // Push current state to undo stack before making changes
  const pushToUndoStack = useCallback(() => {
    setUndoStack((prev) => [...prev, currentPlan]);
    setRedoStack([]); // Clear redo stack on new action
  }, [currentPlan]);

  // Reorder task in subtasks array
  const reorderTask = useCallback(
    (taskId: string, newIndex: number) => {
      pushToUndoStack();
      setCurrentPlan((prev) => {
        const subtasks = [...prev.subtasks];
        const currentIndex = subtasks.findIndex((t) => t.id === taskId);
        if (currentIndex === -1) {
          return prev;
        }

        const [task] = subtasks.splice(currentIndex, 1);
        if (task) {
          subtasks.splice(newIndex, 0, task);
        }

        return { ...prev, subtasks };
      });
    },
    [pushToUndoStack]
  );

  // Update task properties
  const updateTask = useCallback(
    (taskId: string, updates: Partial<SubTask>) => {
      pushToUndoStack();
      setCurrentPlan((prev) => {
        const subtasks = prev.subtasks.map((task: SubTask) =>
          task.id === taskId ? { ...task, ...updates } : task
        );
        return { ...prev, subtasks };
      });
    },
    [pushToUndoStack]
  );

  // Remove task
  const removeTask = useCallback(
    (taskId: string) => {
      pushToUndoStack();
      setCurrentPlan((prev) => {
        // Remove from subtasks
        const subtasks = prev.subtasks.filter((t: SubTask) => t.id !== taskId);

        // Remove from waves
        const waves = prev.waves.map((wave: WavePlan) => ({
          ...wave,
          agents: wave.agents.filter((id: string) => id !== taskId),
        }));

        // Remove dependencies
        const cleanedSubtasks = subtasks.map((task: SubTask) => ({
          ...task,
          deps: task.deps.filter((id: string) => id !== taskId),
        }));

        return { ...prev, subtasks: cleanedSubtasks, waves };
      });
    },
    [pushToUndoStack]
  );

  // Add new task
  const addTask = useCallback(
    (task: SubTask, afterTaskId?: string) => {
      pushToUndoStack();
      setCurrentPlan((prev) => {
        const subtasks = [...prev.subtasks];
        if (afterTaskId) {
          const index = subtasks.findIndex((t) => t.id === afterTaskId);
          subtasks.splice(index + 1, 0, task);
        } else {
          subtasks.push(task);
        }

        return { ...prev, subtasks };
      });
    },
    [pushToUndoStack]
  );

  // Move task to specific wave
  const moveTaskToWave = useCallback(
    (taskId: string, waveId: string) => {
      pushToUndoStack();
      setCurrentPlan((prev) => {
        const waves = prev.waves.map((wave: WavePlan) => {
          // Remove from all waves
          const agents = wave.agents.filter((id: string) => id !== taskId);
          // Add to target wave
          if (wave.id === waveId) {
            agents.push(taskId);
          }
          return { ...wave, agents };
        });

        return { ...prev, waves };
      });
    },
    [pushToUndoStack]
  );

  // Regenerate waves based on dependencies
  const regenerateWaves = useCallback(() => {
    pushToUndoStack();
    setCurrentPlan((prev) => {
      const waves = generateWavesFromDependencies(prev.subtasks);
      return { ...prev, waves, waveCount: waves.length };
    });
  }, [pushToUndoStack]);

  // Undo last action
  const undo = useCallback(() => {
    if (undoStack.length === 0) {
      return;
    }

    const previous = undoStack.at(-1);
    if (previous) {
      setRedoStack((prev) => [...prev, currentPlan]);
      setCurrentPlan(previous);
      setUndoStack((prev) => prev.slice(0, -1));
    }
  }, [undoStack, currentPlan]);

  // Redo last undone action
  const redo = useCallback(() => {
    if (redoStack.length === 0) {
      return;
    }

    const next = redoStack.at(-1);
    if (next) {
      setUndoStack((prev) => [...prev, currentPlan]);
      setCurrentPlan(next);
      setRedoStack((prev) => prev.slice(0, -1));
    }
  }, [redoStack, currentPlan]);

  // Reset to initial plan
  const reset = useCallback(() => {
    setCurrentPlan(initialPlan);
    setUndoStack([]);
    setRedoStack([]);
  }, [initialPlan]);

  // Save current plan
  const save = useCallback(async () => {
    if (onSave) {
      await onSave(currentPlan);
    }
  }, [currentPlan, onSave]);

  return {
    state: {
      plan: currentPlan,
      modified,
      undoStack,
      redoStack,
      validation,
    },
    actions: {
      reorderTask,
      updateTask,
      removeTask,
      addTask,
      moveTaskToWave,
      regenerateWaves,
      undo,
      redo,
      reset,
      save,
    },
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Validate plan for errors and warnings.
 */
function validatePlan(plan: PlanPhaseOutput): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty waves
  for (const wave of plan.waves) {
    if (wave.agents.length === 0) {
      warnings.push(`Wave ${wave.id} has no agents`);
    }
  }

  // Check for orphaned tasks (not in any wave)
  const allWaveAgents = new Set(plan.waves.flatMap((w: WavePlan) => w.agents));
  for (const task of plan.subtasks) {
    if (!allWaveAgents.has(task.id)) {
      errors.push(`Task ${task.id} is not assigned to any wave`);
    }
  }

  // Check for circular dependencies
  const circularDeps = findCircularDependencies(plan.subtasks);
  for (const cycle of circularDeps) {
    errors.push(`Circular dependency: ${cycle.join(" → ")}`);
  }

  // Check for invalid dependencies
  const taskIds = new Set(plan.subtasks.map((t: SubTask) => t.id));
  for (const task of plan.subtasks) {
    for (const depId of task.deps) {
      if (!taskIds.has(depId)) {
        errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
      }
    }
  }

  // Check wave dependencies
  const waveIds = new Set(plan.waves.map((w: WavePlan) => w.id));
  for (const wave of plan.waves) {
    for (const depId of wave.dependsOn) {
      if (!waveIds.has(depId)) {
        errors.push(`Wave ${wave.id} depends on non-existent wave ${depId}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Find circular dependencies in task graph.
 */
function findCircularDependencies(subtasks: SubTask[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (taskId: string, path: string[]): void => {
    if (recursionStack.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      cycles.push(path.slice(cycleStart));
      return;
    }

    if (visited.has(taskId)) {
      return;
    }

    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);

    const task = subtasks.find((t) => t.id === taskId);
    for (const depId of task?.deps ?? []) {
      dfs(depId, [...path]);
    }

    recursionStack.delete(taskId);
  };

  for (const task of subtasks) {
    dfs(task.id, []);
  }

  return cycles;
}

/**
 * Generate waves from task dependencies using topological sort.
 */
function generateWavesFromDependencies(subtasks: SubTask[]): WavePlan[] {
  const waves: WavePlan[] = [];
  const completed = new Set<string>();
  let waveIndex = 0;

  while (completed.size < subtasks.length) {
    // Find tasks with all dependencies completed
    const ready = subtasks.filter((task) => {
      if (completed.has(task.id)) {
        return false;
      }
      return task.deps.every((depId: string) => completed.has(depId));
    });

    if (ready.length === 0) {
      // No progress - circular dependency or error
      // Put remaining tasks in final wave
      const remaining = subtasks.filter((t: SubTask) => !completed.has(t.id));
      if (remaining.length > 0) {
        waves.push({
          id: `wave-${waveIndex}`,
          agents: remaining.map((t) => t.id),
          dependsOn: waveIndex > 0 ? [`wave-${waveIndex - 1}`] : [],
        });
      }
      break;
    }

    // Create wave
    waves.push({
      id: `wave-${waveIndex}`,
      agents: ready.map((t) => t.id),
      dependsOn: waveIndex > 0 ? [`wave-${waveIndex - 1}`] : [],
    });

    // Mark as completed
    for (const task of ready) {
      completed.add(task.id);
    }

    waveIndex++;
  }

  return waves;
}
