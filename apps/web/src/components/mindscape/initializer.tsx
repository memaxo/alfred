import { useMindscapeStore } from "@/store/mindscape";
import { useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";
import { useShallow } from "zustand/react/shallow";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type NoteListItem = RouterOutputs["note"]["list"][number];
type DueReminderItem = RouterOutputs["remind"]["due"][number];
type GraphEdge = RouterOutputs["graph"]["getEdges"][number];

export function MindscapeInitializer() {
  const { addArtifact, autoLayout, nodeIds } = useMindscapeStore(
    useShallow((state) => ({
      addArtifact: state.addArtifact,
      autoLayout: state.autoLayout,
      nodeIds: state.nodes.map((n) => n.id),
    }))
  );

  const { data: notes } = trpc.note.list.useQuery({ limit: 5 });
  const { data: reminders } = trpc.remind.due.useQuery({});
  const { data: edges } = trpc.graph.getEdges.useQuery(
    { nodeIds },
    { enabled: nodeIds.length > 0, refetchInterval: 5000 }
  );
  const initializedRef = useRef(false);
  const { setEdges } = useMindscapeStore(useShallow((state) => ({ setEdges: state.setEdges })));

  // Initialize with Chat Node after Orb is created
  useEffect(() => {
    if (initializedRef.current) return;

    const hasOrb = nodeIds.includes("singularity");
    // Check for any chat node to avoid duplicates on reload if persisted
    const hasChat = nodeIds.some((id) => {
        const node = useMindscapeStore.getState().nodes.find(n => n.id === id);
        return node?.type === 'chat';
    });

    if (hasOrb && !hasChat) {
      const chatId = nanoid();
      addArtifact({
        id: chatId,
        type: "chat",
        position: { x: 500, y: 0 },
        data: {
          label: "Neural Stream",
          messages: [],
        },
      });
      
      initializedRef.current = true;

      // Trigger layout after adding chat
      setTimeout(() => {
        autoLayout();
      }, 100);
    }
  }, [nodeIds, addArtifact, autoLayout]);

  // Sync Notes
  useEffect(() => {
    if (!notes) return;

    notes.forEach((note: NoteListItem, index: number) => {
      const noteNodeId = `note-${note.id}`;
      if (nodeIds.includes(noteNodeId)) return;

      addArtifact({
        id: noteNodeId,
        type: "note",
        position: { x: 800 + (index * 30), y: -200 + (index * 60) },
        data: {
          label: note.title?.trim() || "Untitled Note",
          noteId: note.id,
          title: note.title,
          content: note.content,
          tags: note.tags,
          mode: "view",
          updatedAt: note.updatedAt?.toISOString?.() ?? undefined,
        },
      });
    });
  }, [notes, nodeIds, addArtifact]);

  // Sync Reminders
  useEffect(() => {
    if (!reminders) return;

    reminders.forEach((reminder: DueReminderItem, index: number) => {
      const reminderNodeId = `reminder-${reminder.id}`;
      if (nodeIds.includes(reminderNodeId)) return;

      const dueIso = reminder.due instanceof Date ? reminder.due.toISOString() : reminder.due;
      const isDue = dueIso ? new Date(dueIso).getTime() <= Date.now() : false;
      const status = reminder.firedAt ? "fired" : isDue ? "due" : "scheduled";

      addArtifact({
        id: reminderNodeId,
        type: "reminder",
        position: { x: -800 - (index * 30), y: -200 + (index * 60) },
        data: {
          label: reminder.title || "Reminder",
          reminderId: reminder.id,
          title: reminder.title,
          due: dueIso,
          description: reminder.description ?? undefined,
          status,
          mode: "view",
        },
      });
    });
  }, [reminders, nodeIds, addArtifact]);

  // Sync Edges
  useEffect(() => {
    if (!edges) return;

    const newEdges = edges.map((edge: GraphEdge) => {
      // Helper to find the correct node ID for a given DB ID
      const findNodeId = (dbId: string) => {
        // Try to find a node that ends with this DB ID
        const match = nodeIds.find(id => id.endsWith(dbId));
        return match || `note-${dbId}`; // Fallback to note prefix if not found (or maybe it's not loaded yet)
      };

      return {
        id: edge.id,
        source: findNodeId(edge.fromId),
        target: findNodeId(edge.toId),
        animated: true,
        style: { stroke: "rgba(255, 255, 255, 0.2)" },
      };
    });

    // Only update if edges have changed to avoid loops/jitters
    // For now, just set them.
    setEdges(newEdges);
  }, [edges, setEdges, nodeIds]);

  return null;
}
