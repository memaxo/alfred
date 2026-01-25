/**
 * Hooks for Pipeline Phase APIs
 *
 * Provides React hooks for interacting with phase-level workflow endpoints:
 * - useWorkflowPlan: Plan-only subscription (init → schedule)
 * - usePhaseStatus: Poll phase status
 * - useWorkflowExecute: Execute prepared plan
 */

import type { PipelineEvent } from "@alfred/pipeline";
import type {
  ExecutePhaseInput,
  PhaseStatus,
  PlanPhaseOutput,
} from "@alfred/pipeline/schemas";

import { skipToken } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { trpc } from "@/utils/trpc";

export type PlanStatus = "idle" | "planning" | "ready" | "error";

export interface PlanStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;
  startTime?: number;
}

// --- useWorkflowPlan Hook ---

interface UseWorkflowPlanOptions {
  requirement: string;
  workspace?: string;
  onPlanReady?: (plan: PlanPhaseOutput) => void;
  onError?: (error: Error) => void;
}

export interface UseWorkflowPlanReturn {
  plan: PlanPhaseOutput | null;
  status: PlanStatus;
  error: Error | null;
  steps: PlanStep[];
  start: () => void;
  stop: () => void;
  clear: () => void;
}

/**
 * Hook to generate a plan without executing it.
 * Subscribes to phase.streamPlan for real-time progress.
 */
export function useWorkflowPlan(
  options: UseWorkflowPlanOptions
): UseWorkflowPlanReturn {
  const { requirement, workspace, onPlanReady, onError } = options;

  const [plan, setPlan] = useState<PlanPhaseOutput | null>(null);
  const [status, setStatus] = useState<PlanStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const stepsRef = useRef<PlanStep[]>([]);
  const runIdRef = useRef<string | null>(null);
  const loadedPlanRef = useRef(false);
  const planOutputRef = useRef<unknown | null>(null);
  const scheduleOutputRef = useRef<unknown | null>(null);
  const contextOutputRef = useRef<unknown | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const lastEventAtRef = useRef<number | null>(null);
  const utils = trpc.useUtils();

  const clear = useCallback(() => {
    setPlan(null);
    setSteps([]);
    setError(null);
    setStatus("idle");
    setEnabled(false);
    setRunId(null);
    stepsRef.current = [];
    runIdRef.current = null;
    loadedPlanRef.current = false;
    planOutputRef.current = null;
    scheduleOutputRef.current = null;
    contextOutputRef.current = null;
    startedAtRef.current = null;
    lastEventAtRef.current = null;
  }, []);

  const stop = useCallback(() => {
    setEnabled(false);
    if (status === "planning") {
      setStatus("idle");
    }
  }, [status]);

  const start = useCallback(() => {
    clear();
    const nextRunId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`;
    runIdRef.current = nextRunId;
    setRunId(nextRunId);
    setEnabled(true);
    setStatus("planning");
  }, [clear]);

  const ensureStep = useCallback(
    (id: string, name: string, stepStatus: PlanStep["status"]) => {
      const existingIdx = stepsRef.current.findIndex((s) => s.id === id);
      if (existingIdx !== -1) {
        const step = stepsRef.current[existingIdx];
        if (step && step.status !== stepStatus) {
          stepsRef.current[existingIdx] = {
            id: step.id,
            name: step.name,
            status: stepStatus,
            duration:
              stepStatus === "completed" || stepStatus === "failed"
                ? Date.now() - (step.startTime ?? Date.now())
                : step.duration,
            startTime: step.startTime,
          };
        }
      } else {
        stepsRef.current.push({
          id,
          name,
          status: stepStatus,
          startTime: Date.now(),
        });
      }
      setSteps([...stepsRef.current]);
    },
    []
  );

  const updateStep = useCallback(
    (id: string, stepStatus: PlanStep["status"]) => {
      const existingIdx = stepsRef.current.findIndex((s) => s.id === id);
      if (existingIdx !== -1) {
        const step = stepsRef.current[existingIdx];
        if (step) {
          stepsRef.current[existingIdx] = {
            id: step.id,
            name: step.name,
            status: stepStatus,
            duration:
              stepStatus === "completed" || stepStatus === "failed"
                ? Date.now() - (step.startTime ?? Date.now())
                : step.duration,
            startTime: step.startTime,
          };
          setSteps([...stepsRef.current]);
        }
      }
    },
    []
  );

  const trimmed = requirement.trim();
  const input =
    enabled && runId ? { runId, requirement: trimmed, workspace } : skipToken;

  const tryEmitPlanFromContext = useCallback(() => {
    const runId = runIdRef.current;
    const planOutput = planOutputRef.current;
    const scheduleOutput = scheduleOutputRef.current;
    if (!(runId && planOutput && scheduleOutput)) {
      return false;
    }
    if (typeof planOutput !== "object" || typeof scheduleOutput !== "object") {
      return false;
    }

    const planObj = planOutput as {
      planId?: unknown;
      structuredPlan?: unknown;
      subtasks?: unknown;
      execPlans?: unknown;
      rootPlanPath?: unknown;
    };
    const schedObj = scheduleOutput as {
      waves?: unknown;
      executionMode?: unknown;
      estimatedDuration?: unknown;
    };

    const waves = Array.isArray(schedObj.waves) ? schedObj.waves : [];

    const execPlansRaw = planObj.execPlans;
    const execPlans = (() => {
      if (execPlansRaw && typeof execPlansRaw === "object") {
        if (!Array.isArray(execPlansRaw)) {
          return execPlansRaw as Record<string, string>;
        }
        const entries = execPlansRaw.filter(
          (e): e is [string, string] =>
            Array.isArray(e) &&
            typeof e[0] === "string" &&
            typeof e[1] === "string"
        );
        return Object.fromEntries(entries);
      }
      return {};
    })();

    const out: PlanPhaseOutput = {
      runId,
      planId: typeof planObj.planId === "string" ? planObj.planId : "",
      structuredPlan:
        planObj.structuredPlan as PlanPhaseOutput["structuredPlan"],
      waves: waves as PlanPhaseOutput["waves"],
      waveCount: waves.length,
      subtasks: (Array.isArray(planObj.subtasks)
        ? planObj.subtasks
        : []) as PlanPhaseOutput["subtasks"],
      execPlans,
      rootPlanPath:
        typeof planObj.rootPlanPath === "string" ? planObj.rootPlanPath : "",
      executionMode:
        schedObj.executionMode === "parallel" ? "parallel" : "sequential",
      estimatedDuration:
        typeof schedObj.estimatedDuration === "number"
          ? schedObj.estimatedDuration
          : 0,
      snapshot: {
        runId,
        status: "suspended",
        requirement: trimmed.length > 0 ? trimmed : "workflow",
        lastCompletedStage: "schedule",
        lastCompletedStageIndex: 3,
        startedAt: startedAtRef.current ?? Date.now(),
        lastEventAt: lastEventAtRef.current ?? Date.now(),
        error: null,
      },
      context: (() => {
        const ctx = contextOutputRef.current;
        if (!ctx || typeof ctx !== "object") {
          return;
        }
        const obj = ctx as { totalTokens?: unknown; ragChunks?: unknown };
        const ragChunkCount = Array.isArray(obj.ragChunks)
          ? obj.ragChunks.length
          : 0;
        return {
          totalTokens:
            typeof obj.totalTokens === "number" ? obj.totalTokens : 0,
          ragChunkCount,
        };
      })(),
    };

    setPlan(out);
    setStatus("ready");
    onPlanReady?.(out);
    return true;
  }, [onPlanReady, trimmed]);

  // Subscribe to phase.streamPlan
  trpc.workflow.phase.streamPlan.useSubscription(input as never, {
    enabled: enabled && !!runId && trimmed.length > 0,
    onStarted: () => {
      setStatus("planning");
    },
    onData: (event: PipelineEvent) => {
      lastEventAtRef.current = event.timestamp;
      switch (event.type) {
        case "pipeline:start": {
          runIdRef.current = event.runId;
          setRunId(event.runId);
          startedAtRef.current = event.timestamp;
          break;
        }

        case "context:set": {
          if (event.key === "planOutput") {
            planOutputRef.current = event.value;
          }
          if (event.key === "scheduleOutput") {
            scheduleOutputRef.current = event.value;
          }
          if (event.key === "contextOutput") {
            contextOutputRef.current = event.value;
          }
          break;
        }

        case "stage:enter": {
          ensureStep(event.stage, event.stage, "running");
          break;
        }

        case "stage:exit": {
          updateStep(event.stage, "completed");
          if (event.stage === "schedule" && !loadedPlanRef.current) {
            loadedPlanRef.current = true;
            setStatus("ready");
            if (!tryEmitPlanFromContext()) {
              void loadPlan();
            }
          }
          break;
        }

        case "stage:error": {
          updateStep(event.stage, "failed");
          setError(new Error(event.error));
          setStatus("error");
          onError?.(new Error(event.error));
          break;
        }

        case "stage:progress": {
          ensureStep(event.stage, event.stage, "running");
          break;
        }

        case "pipeline:suspend": {
          // Plan phase complete - load the plan via mutation
          if (!loadedPlanRef.current) {
            loadedPlanRef.current = true;
            setStatus("ready");
            if (!tryEmitPlanFromContext()) {
              void loadPlan();
            }
          }
          break;
        }

        case "pipeline:complete": {
          // Some plan-only runs may end with a completion event rather than an
          // explicit suspend. Treat this as "plan ready" and fetch the plan.
          if (!loadedPlanRef.current) {
            loadedPlanRef.current = true;
            setStatus("ready");
            if (!tryEmitPlanFromContext()) {
              void loadPlan();
            }
          }
          break;
        }

        case "pipeline:failed": {
          setError(new Error(event.error));
          setStatus("error");
          onError?.(new Error(event.error));
          break;
        }
      }
    },
    onError: (err) => {
      setError(new Error(err.message));
      setStatus("error");
      onError?.(new Error(err.message));
    },
  });

  const loadPlan = async (attempt = 0): Promise<void> => {
    const id = runIdRef.current;
    if (!id) {
      return;
    }
    try {
      const data = await utils.workflow.phase.getPlan.fetch({ runId: id });
      setPlan(data);
      setStatus("ready");
      onPlanReady?.(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const retryable =
        msg.includes("snapshot_not_found") ||
        msg.includes("plan_not_ready") ||
        msg.includes("NOT_FOUND") ||
        msg.includes("BAD_REQUEST");

      if (retryable && attempt < 8) {
        const delayMs = Math.min(1500, 150 * 2 ** attempt);
        globalThis.setTimeout(() => {
          void loadPlan(attempt + 1);
        }, delayMs);
        return;
      }

      const nextError = new Error(msg);
      setError(nextError);
      setStatus("error");
      onError?.(nextError);
    }
  };

  return {
    plan,
    status,
    error,
    steps,
    start,
    stop,
    clear,
  };
}

// --- usePhaseStatus Hook ---

interface UsePhaseStatusOptions {
  pollingInterval?: number;
  enabled?: boolean;
}

export interface UsePhaseStatusReturn {
  status: PhaseStatus | null;
  canResume: boolean;
  nextStage: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to poll phase status for a run.
 * Returns current stage, resume capability, and next stage.
 */
export function usePhaseStatus(
  runId: string | null,
  options: UsePhaseStatusOptions = {}
): UsePhaseStatusReturn {
  const { pollingInterval = 5000, enabled = true } = options;

  const query = trpc.workflow.phase.status.useQuery(
    runId ? { runId } : skipToken,
    {
      enabled: enabled && !!runId,
      refetchInterval: pollingInterval,
      refetchIntervalInBackground: false,
    }
  );

  return {
    status: query.data ?? null,
    canResume: query.data?.canResume ?? false,
    nextStage: query.data?.nextStage ?? null,
    isLoading: query.isLoading,
    error: query.error ? new Error(query.error.message) : null,
    refetch: query.refetch,
  };
}

// --- useWorkflowExecute Hook ---

export interface ExecuteProgress {
  stage: string;
  message?: string;
  timestamp: number;
}

export interface UseWorkflowExecuteReturn {
  execute: (input: ExecutePhaseInput) => Promise<void>;
  isExecuting: boolean;
  progress: ExecuteProgress[];
  error: Error | null;
  clear: () => void;
}

/**
 * Hook to execute a prepared plan.
 * Uses phase.execute mutation with progress tracking.
 */
export function useWorkflowExecute(): UseWorkflowExecuteReturn {
  const [progress, setProgress] = useState<ExecuteProgress[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const mutation = trpc.workflow.phase.execute.useMutation({
    onSuccess: () => {
      setProgress((prev) => [
        ...prev,
        {
          stage: "complete",
          message: "Execution completed",
          timestamp: Date.now(),
        },
      ]);
    },
    onError: (err) => {
      setError(new Error(err.message));
      setProgress((prev) => [
        ...prev,
        {
          stage: "error",
          message: err.message,
          timestamp: Date.now(),
        },
      ]);
    },
  });

  const execute = useCallback(
    async (input: Parameters<typeof mutation.mutateAsync>[0]) => {
      setProgress([]);
      setError(null);
      setProgress([
        {
          stage: "starting",
          message: "Starting execution",
          timestamp: Date.now(),
        },
      ]);
      await mutation.mutateAsync(input);
    },
    [mutation]
  );

  const clear = useCallback(() => {
    setProgress([]);
    setError(null);
  }, []);

  return {
    execute,
    isExecuting: mutation.isPending,
    progress,
    error,
    clear,
  };
}
