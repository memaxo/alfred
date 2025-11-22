import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { dispatchMindscapeEvent } from "@/hooks/use-mindscape-activations";
import { getToolToken } from "@/lib/token";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";
import { trpc } from "@/utils/trpc";

type StreamInput = {
  requirement: string;
  authz: string;
  auto: "read" | "low" | "medium" | "high";
  mode: "sequential" | "parallel";
  context: {
    enable: boolean;
    web: boolean;
  };
};

function eventToUiMessages(_event: WorkflowEvent): UIMessage[] {
  // Placeholder: UI tests do not depend on the exact shape yet.
  return [];
}

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

  const [streamInput, setStreamInput] = useState<StreamInput | null>(null);
  const [status, setStatus] = useState<string>(
    (data.status as string) || "pending"
  );
  const processedEvents = useRef(new Set<string>());

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

  // Subscription
  const input = streamInput ?? {
    requirement: "",
    authz: "",
    auto: "read",
    mode: "sequential",
    context: { enable: false, web: false },
  };

  trpc.workflow.stream.useSubscription(input, {
    enabled: !!streamInput,
    onData(event: WorkflowEvent) {
      // Pulse outgoing edges on ANY event to visualize activity
      dispatchMindscapeEvent({
          type: "workflow-step",
          sourceId: nodeId
      });

      // Update node data based on event
      const evtId = (event as any).eventId || Date.now().toString();
      if (processedEvents.current.has(evtId)) {
        return;
      }
      processedEvents.current.add(evtId);

      if (event.type === "run") {
        updateArtifactData(nodeId, {
          status: "running",
          runId: (event as any).id,
        });
        setStatus("running");
      } else if (event.type === "progress") {
        // Update progress description?
      } else if (event.type === "complete") {
        updateArtifactData(nodeId, { status: "completed" });
        setStreamInput(null); // Stop stream
      } else if (event.type === "error") {
        updateArtifactData(nodeId, {
          status: "failed",
          error: (event as any).message,
        });
        setStreamInput(null);
      }

      // For UI messages (Plan/Tasks), we parse them
      const uiMessages = eventToUiMessages(event);
      if (uiMessages && uiMessages.length > 0) {
        updateArtifactData(nodeId, {
          messages: [...((data.messages as any[]) || []), ...uiMessages],
        });
      }
    },
    onError(err) {
      console.error("Workflow stream error:", err);
      updateArtifactData(nodeId, { status: "failed", error: err.message });
      setStreamInput(null);
    },
  });

  return null;
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
