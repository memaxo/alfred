import type { WorkflowEvent } from "@alfred/type";
import { useCallback, useRef, useState } from "react";
import type { WindowData } from "@/store/desktop/types";
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
  run: (input: any) => void;
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
  const [input, setInput] = useState<any>(null);

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
    (workflowInput: any) => {
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
      onWindowUpdate?.({ steps: [...stepsRef.current] } as any);
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
          onWindowUpdate?.({ steps: [...stepsRef.current] } as any);
        }
      }
    },
    [onWindowUpdate]
  );

  trpc.workflow.stream.useSubscription(input, {
    enabled: enabled && !!input,
    onStarted: () => {
      setStatus("running");
      onWindowUpdate?.({ status: "running" });
    },
    onData: (event: any) => {
      const workflowEvent = event as WorkflowEvent;
      switch (workflowEvent._) {
        case "run":
          // Initial run event might contain runId
          break;

        case "step-start":
        case "step_start": {
          const phaseId =
            typeof event.phase === "string" ? event.phase : "step";
          const phaseName = (event.phase as any)?.name ?? phaseId;
          ensureStep(phaseId, phaseName, "running");
          break;
        }

        case "step-complete":
        case "step_complete": {
          const phaseId =
            typeof event.phase === "string" ? event.phase : "step";
          updateStep(phaseId, "completed");
          break;
        }

        case "progress": {
          if (event.pct !== undefined) {
            const message = event.message ?? `Progress ${event.pct}%`;
            ensureStep("progress", message, "running");
          }
          break;
        }

        case "notice": {
          ensureStep("notice", event.message, "completed");
          break;
        }

        case "error": {
          setError(new Error(event.message));
          setStatus("error");
          onError?.(new Error(event.message));
          onWindowUpdate?.({ status: "failed" });
          break;
        }

        case "obligation": {
          setStatus("suspended");
          setRunId(event.runId);
          onWindowUpdate?.({
            status: "suspended",
            runId: event.runId,
          });
          break;
        }

        case "finish": {
          setStatus("completed");
          onWindowUpdate?.({ status: "completed" });
          break;
        }

        case "ui-message": {
          // Sync messages to window store
          onWindowUpdate?.({
            messages: event.messages,
          } as any);
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
