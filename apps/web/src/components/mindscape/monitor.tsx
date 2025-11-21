import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
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
      // Update node data based on event
      // Simple logic for now: accumulate tasks/logs
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
        // Here we would ideally merge with existing messages/tasks
        // For now, we'll just push to a 'messages' array in data
        // WorkflowNode can parse them into tasks
        // Or we assume WorkflowNode parses 'messages'
        // Let's append to messages
        updateArtifactData(nodeId, {
          messages: [...((data.messages as any[]) || []), ...uiMessages],
        });
      }
    },
    onError(err) {
      updateArtifactData(nodeId, { status: "failed", error: err.message });
      setStreamInput(null);
    },
  });

  return null;
}

export function WorkflowManager() {
  // Subscribe to nodes that need processing
  // We only manage 'pending' (to start) or 'starting' (in progress) nodes
  // Once 'completed' or 'failed', we stop managing them here (component unmounts)
  // But we want to keep them rendered in Canvas.
  // So we filter for active ones.
  // If status is 'running', we also need to keep Subscription active if we started it.
  // But here we are creating NEW subscriptions for every node matching filter.
  // If node status changes to 'running' inside WorkflowSubscription, it still matches filter?
  // Yes.
  // We need to make sure we don't restart subscription.
  // WorkflowSubscription handles internal state `streamInput`.

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
