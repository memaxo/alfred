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

export type PlanStep = {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;
  startTime?: number;
};

// --- useWorkflowPlan Hook ---

type UseWorkflowPlanOptions = {
  requirement: string;
  workspace: string;
  userId?: string;
  onPlanReady?: (plan: PlanPhaseOutput) => void;
  onError?: (error: Error) => void;
};

export type UseWorkflowPlanReturn = {
  plan: PlanPhaseOutput | null;
  status: PlanStatus;
  error: Error | null;
  steps: PlanStep[];
  start: () => void;
  stop: () => void;
  clear: () => void;
};

/**
 * Hook to generate a plan without executing it.
 * Subscribes to phase.streamPlan for real-time progress.
 */
export function useWorkflowPlan(
  options: UseWorkflowPlanOptions
): UseWorkflowPlanReturn {
  const { requirement, workspace, userId, onPlanReady, onError } = options;

  const [plan, setPlan] = useState<PlanPhaseOutput | null>(null);
  const [status, setStatus] = useState<PlanStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [enabled, setEnabled] = useState(false);

  const stepsRef = useRef<PlanStep[]>([]);

  const clear = useCallback(() => {
    setPlan(null);
    setSteps([]);
    setError(null);
    setStatus("idle");
    setEnabled(false);
    stepsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    setEnabled(false);
    if (status === "planning") {
      setStatus("idle");
    }
  }, [status]);

  const start = useCallback(() => {
    clear();
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

  const input = enabled
    ? { requirement, workspace, userId: userId ?? "default" }
    : skipToken;

  // Subscribe to phase.streamPlan
  trpc.workflow.phase.streamPlan.useSubscription(input as never, {
    enabled: enabled && !!requirement && !!workspace,
    onStarted: () => {
      setStatus("planning");
    },
    onData: (event: PipelineEvent) => {
      switch (event.type) {
        case "pipeline:start": {
          break;
        }

        case "stage:enter": {
          ensureStep(event.stage, event.stage, "running");
          break;
        }

        case "stage:exit": {
          updateStep(event.stage, "completed");
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
          setStatus("ready");
          void loadPlan();
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

  // Helper mutation to load plan after streaming completes
  const planMutation = trpc.workflow.phase.plan.useMutation({
    onSuccess: (data) => {
      setPlan(data);
      setStatus("ready");
      onPlanReady?.(data);
    },
    onError: (err) => {
      setError(new Error(err.message));
      setStatus("error");
      onError?.(new Error(err.message));
    },
  });

  const loadPlan = async () => {
    if (!(requirement && workspace)) {
      return;
    }
    await planMutation.mutateAsync({
      requirement,
      workspace,
      userId: userId ?? "default",
    });
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

type UsePhaseStatusOptions = {
  pollingInterval?: number;
  enabled?: boolean;
};

export type UsePhaseStatusReturn = {
  status: PhaseStatus | null;
  canResume: boolean;
  nextStage: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

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

export type ExecuteProgress = {
  stage: string;
  message?: string;
  timestamp: number;
};

export type UseWorkflowExecuteReturn = {
  execute: (input: ExecutePhaseInput) => Promise<void>;
  isExecuting: boolean;
  progress: ExecuteProgress[];
  error: Error | null;
  clear: () => void;
};

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
