import type { WorkflowEvent } from "@alfred/type";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { dispatchMindscapeEvent } from "@/hooks/use-mindscape-activations";
import { useWorkflowSseStream, type WorkflowStreamInput } from "@/hooks/use-workflow-sse-stream";
import { getToolToken } from "@/lib/token";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";
import { ObligationChallengeDialog } from "@/components/biometric-challenge-dialog";
import { useObligationResume } from "@/hooks/use-biometric-resume";

type StreamInput = WorkflowStreamInput & {
  context: {
    enable: boolean;
    web: boolean;
  };
};

function WorkflowSubscription({
  nodeId,
  data,
}: {
  nodeId: string;
  data: ArtifactData;
}) {
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );
  const recordContextReceipt = useMindscapeStore(
    (state) => state.recordContextReceipt
  );
  const clearContextReceipt = useMindscapeStore(
    (state) => state.clearContextReceipt
  );
  const resolveCurrentMessages = () => {
    const node = useMindscapeStore
      .getState()
      .nodes.find((n) => n.id === nodeId);
    const nodeMessages = (node?.data as ArtifactData | undefined)?.messages;
    return Array.isArray(nodeMessages) ? nodeMessages : [];
  };

  const [streamInput, setStreamInput] = useState<StreamInput | null>(null);
  const [status, setStatus] = useState<string>(
    (data.status as string) || "pending"
  );
  const processedEvents = useRef(new Set<string>());
  const resume = useObligationResume({ target: "workflow" });

  // Prepare stream input
  useEffect(() => {
    if (status === "pending" && !streamInput) {
      const prepare = async () => {
        try {
          const auto = (data.auto as any) || "low";
          // Mock token for test env if getToolToken fails (e.g. in tests)
          // Or wrap in try/catch.
          // Ideally getToolToken should be mocked in tests.
          // For now, assume it works or throws.
          const token = await getToolToken(
            ["droid.exec", "repo.read", "repo.write"],
            auto
          );

          setStreamInput({
            requirement: (data.requirement as string) || "Run workflow",
            authz: `Bearer ${token}`,
            auto,
            mode: (data.mode as any) || "sequential",
            context: {
              enable: true,
              web: true,
            },
          });
          setStatus("starting");
          updateArtifactData(nodeId, { status: "starting" });
        } catch (err) {
          console.error("Failed to prepare workflow stream:", err);
          setStatus("error");
          updateArtifactData(nodeId, { status: "failed", error: String(err) });
        }
      };
      prepare();
    }
  }, [status, streamInput, data, nodeId, updateArtifactData]);

  useWorkflowSseStream({
    input: streamInput,
    onWorkflowEvent(event: WorkflowEvent) {
      dispatchMindscapeEvent({
        type: "workflow-step",
        sourceId: nodeId,
      });

      const evtId = (event as any).eventId || Date.now().toString();
      if (processedEvents.current.has(evtId)) {
        return;
      }
      processedEvents.current.add(evtId);

      if (event.type === "obligation") {
        setStatus("suspended");
        resume.prompt({
          runId: event.runId,
          obligations: event.obligations,
          resumeEvents: event.resumeEvents ?? [],
        });
        updateArtifactData(nodeId, {
          status: "suspended",
          pendingRunId: event.runId,
        });
        return;
      }

      if (event.type === "data-cache-handoff") {
        recordContextReceipt(nodeId, {
          source: "handoff",
          receipt: (event as any).receipts,
        });
        dispatchMindscapeEvent({
          type: "context-cache",
          sourceId: nodeId,
        });
        return;
      }

      if (event.type === "context") {
        recordContextReceipt(nodeId, {
          source: (event as any).phase ?? "context",
          phase: (event as any).phase,
          receipt: (event as any).receipts,
        });
        dispatchMindscapeEvent({
          type: "context-cache",
          sourceId: nodeId,
        });
        return;
      }

      if (event.type === "run") {
        updateArtifactData(nodeId, {
          status: "running",
          runId: (event as any).id,
        });
        setStatus("running");
        resume.close();
      } else if (event.type === "complete") {
        updateArtifactData(nodeId, { status: "completed" });
        clearContextReceipt(nodeId);
        setStreamInput(null);
        resume.close();
      } else if (event.type === "error") {
        updateArtifactData(nodeId, {
          status: "failed",
          error: (event as any).message,
        });
        clearContextReceipt(nodeId);
        setStreamInput(null);
        resume.close();
      }
    },
    onUiMessages(messages) {
      if (!messages.length) {
        return;
      }
      const existing = resolveCurrentMessages();
      updateArtifactData(nodeId, {
        messages: [...existing, ...messages],
      });
    },
    onError(err) {
      console.error("Workflow SSE stream error:", err);
      updateArtifactData(nodeId, { status: "failed", error: err.message });
      clearContextReceipt(nodeId);
      setStatus("error");
      setStreamInput(null);
      resume.close();
    },
  });

  return (
    <ObligationChallengeDialog
      mode="inline"
      onClose={() => {
        resume.close();
      }}
      onSuccess={() => {
        setStatus("running");
      }}
      open={resume.isOpen}
      state={resume.pending}
      target="workflow"
    />
  );
}

export function WorkflowManager() {
  // Subscribe to nodes that need processing
  const activeWorkflowNodes = useMindscapeStore(
    useShallow((state) =>
      state.nodes.filter(
        (n) =>
          n.type === "workflow" &&
          ["pending", "starting", "running"].includes(n.data.status as string)
      )
    )
  );

  return (
    <>
      {activeWorkflowNodes.map((node) => (
        <WorkflowSubscription data={node.data} key={node.id} nodeId={node.id} />
      ))}
    </>
  );
}
