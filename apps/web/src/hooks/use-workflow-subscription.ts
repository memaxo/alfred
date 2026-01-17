import { skipToken } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { PipelineEvent } from "@alfred/pipeline";
import type { WindowData } from "@/store/desktop/types.new";
import { trpc } from "@/utils/trpc";

export type WorkflowRunStatus =
  | "idle"
  | "connecting"
  | "running"
  | "completed"
  | "error"
  | "suspended";

export type WorkflowStep = {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;
  startTime?: number;
};

type UseWorkflowSubscriptionOptions = {
  onWindowUpdate?: (update: Partial<WindowData>) => void;
  onError?: (error: Error) => void;
};

export type UseWorkflowSubscriptionReturn = {
  status: WorkflowRunStatus;
  error: Error | null;
  steps: WorkflowStep[];
  runId: string | null;
  run: (input: unknown) => void;
  stop: () => void;
  clear: () => void;
};

/**
 * Hook to subscribe to workflow execution events via tRPC.
 */
export function useWorkflowSubscription(
  options: UseWorkflowSubscriptionOptions = {}
): UseWorkflowSubscriptionReturn {
  const { onWindowUpdate, onError } = options;
  const [status, setStatus] = useState<WorkflowRunStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [input, setInput] = useState<unknown>(null);

  const stepsRef = useRef<WorkflowStep[]>([]);

  const clear = useCallback(() => {
    setSteps([]);
    setError(null);
    setStatus("idle");
    setRunId(null);
    setEnabled(false);
    stepsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    setEnabled(false);
    if (status === "running" || status === "connecting") {
      setStatus("completed");
    }
  }, [status]);

  const run = useCallback(
    (workflowInput: unknown) => {
      clear();
      setInput(workflowInput);
      setEnabled(true);
      setStatus("connecting");
    },
    [clear]
  );

  const ensureStep = useCallback(
    (id: string, name: string, stepStatus: WorkflowStep["status"]) => {
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
      onWindowUpdate?.({ steps: [...stepsRef.current] });
    },
    [onWindowUpdate]
  );

  const updateStep = useCallback(
    (id: string, stepStatus: WorkflowStep["status"]) => {
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
          onWindowUpdate?.({ steps: [...stepsRef.current] });
        }
      }
    },
    [onWindowUpdate]
  );

  // biome-ignore lint/suspicious/noExplicitAny: trpc subscription input typing mismatch with skipToken
  trpc.workflow.streamPipeline.useSubscription((input as any) ?? skipToken, {
    enabled: enabled && !!input,
    onStarted: () => {
      setStatus("running");
      onWindowUpdate?.({ status: "running" });
    },
    onData: (event: PipelineEvent) => {
      switch (event.type) {
        case "pipeline:start": {
          setRunId(event.runId);
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
          onWindowUpdate?.({ status: "failed" });
          break;
        }

        case "stage:progress": {
          ensureStep(event.stage, event.stage, "running");
          break;
        }

        case "pipeline:suspend": {
          setStatus("suspended");
          onWindowUpdate?.({ status: "suspended" });
          break;
        }

        case "pipeline:resume": {
          setStatus("running");
          onWindowUpdate?.({ status: "running" });
          break;
        }

        case "pipeline:complete": {
          setStatus("completed");
          onWindowUpdate?.({ status: "completed" });
          break;
        }

        case "pipeline:failed": {
          setError(new Error(event.error));
          setStatus("error");
          onError?.(new Error(event.error));
          onWindowUpdate?.({ status: "failed" });
          break;
        }
      }
    },
    onError: (err) => {
      setError(new Error(err.message));
      setStatus("error");
      onError?.(new Error(err.message));
      onWindowUpdate?.({ status: "failed" });
    },
  });

  return {
    status,
    error,
    steps,
    runId,
    run,
    stop,
    clear,
  };
}
