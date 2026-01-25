import type { PipelineEvent } from "@alfred/pipeline";

import { skipToken } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import type { WindowData } from "@/store/desktop/types.new";

import { trpc } from "@/utils/trpc";

export interface WorkflowEscalation {
  agentId: string;
  reason: string;
  details: string;
  suggestions?: string[];
  severity: "warning" | "blocking";
  timestamp: number;
}

export type WorkflowRunStatus =
  | "idle"
  | "connecting"
  | "running"
  | "completed"
  | "error"
  | "suspended";

export interface WorkflowStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;
  startTime?: number;
}

interface UseWorkflowSubscriptionOptions {
  kind?: "start" | "resume";
  onWindowUpdate?: (update: Partial<WindowData>) => void;
  onError?: (error: Error) => void;
}

export interface UseWorkflowSubscriptionReturn {
  status: WorkflowRunStatus;
  error: Error | null;
  steps: WorkflowStep[];
  runId: string | null;
  escalation: WorkflowEscalation | null;
  run: (input: unknown) => void;
  stop: () => void;
  clear: () => void;
}

/**
 * Hook to subscribe to workflow execution events via tRPC.
 */
export function useWorkflowSubscription(
  options: UseWorkflowSubscriptionOptions = {}
): UseWorkflowSubscriptionReturn {
  const { kind = "start", onWindowUpdate, onError } = options;
  const [status, setStatus] = useState<WorkflowRunStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [escalation, setEscalation] = useState<WorkflowEscalation | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [input, setInput] = useState<unknown>(null);

  const stepsRef = useRef<WorkflowStep[]>([]);

  const clear = useCallback(() => {
    setSteps([]);
    setError(null);
    setEscalation(null);
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

      if (
        kind === "resume" &&
        workflowInput &&
        typeof workflowInput === "object" &&
        "runId" in workflowInput &&
        typeof (workflowInput as { runId?: unknown }).runId === "string"
      ) {
        setRunId((workflowInput as { runId: string }).runId);
      }
    },
    [clear, kind]
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

  type StreamInput = Parameters<
    typeof trpc.workflow.streamPipeline.useSubscription
  >[0];
  const startInput: StreamInput =
    kind === "start" && enabled && input ? (input as StreamInput) : skipToken;
  trpc.workflow.streamPipeline.useSubscription(startInput, {
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
          onWindowUpdate?.({
            status: "completed",
            summaryText:
              typeof event.summaryText === "string"
                ? event.summaryText
                : undefined,
          });
          break;
        }

        case "pipeline:failed": {
          setError(new Error(event.error));
          setStatus("error");
          onError?.(new Error(event.error));
          onWindowUpdate?.({ status: "failed" });
          break;
        }

        case "agent:escalate-request": {
          const next: WorkflowEscalation = {
            agentId: event.agentId,
            reason: String(event.reason),
            details: event.details,
            suggestions: event.suggestions,
            severity: event.severity,
            timestamp: event.timestamp,
          };
          setEscalation(next);
          if (event.severity === "blocking") {
            setStatus("suspended");
            onWindowUpdate?.({
              status: "suspended",
              escalation: next,
            } satisfies Partial<WindowData>);
          } else {
            onWindowUpdate?.({
              escalation: next,
            } satisfies Partial<WindowData>);
          }
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

  const resumeRunId = (input as { runId?: unknown } | null)?.runId;
  type ResumeInput = Parameters<
    typeof trpc.workflow.resumePipeline.useSubscription
  >[0];
  const resumeInput: ResumeInput =
    kind === "resume" && enabled && typeof resumeRunId === "string"
      ? { runId: resumeRunId }
      : skipToken;
  trpc.workflow.resumePipeline.useSubscription(resumeInput, {
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
          onWindowUpdate?.({
            status: "completed",
            summaryText:
              typeof event.summaryText === "string"
                ? event.summaryText
                : undefined,
          });
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
    escalation,
    run,
    stop,
    clear,
  };
}
