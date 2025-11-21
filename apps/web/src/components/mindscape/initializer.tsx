import { useMindscapeStore, type ArtifactData } from "@/store/mindscape";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";
import { useShallow } from "zustand/react/shallow";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type NoteListItem = RouterOutputs["note"]["list"][number];
type DueReminderItem = RouterOutputs["remind"]["due"][number];
type GraphEdge = RouterOutputs["graph"]["getEdges"][number];
type GraphNode = RouterOutputs["graph"]["runQuery"]["nodes"][number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function MindscapeInitializer() {
  const { nodes, addArtifact, autoLayout, setEdges } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      addArtifact: state.addArtifact,
      autoLayout: state.autoLayout,
      setEdges: state.setEdges,
    }))
  );

  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const graphNodeIds = useMemo(() => {
    const derived = nodes
      .map((node) => {
        if (node.data?.graph?.dbId) {
          return node.data.graph.dbId;
        }
        if (UUID_PATTERN.test(node.id)) {
          return node.id;
        }
        const suffix = node.id.split("-").pop();
        if (suffix && UUID_PATTERN.test(suffix)) {
          return suffix;
        }
        return undefined;
      })
      .filter((id): id is string => Boolean(id));
    return Array.from(new Set(derived));
  }, [nodes]);

  const { data: notes } = trpc.note.list.useQuery({ limit: 5 });
  const { data: reminders } = trpc.remind.due.useQuery({});
  const { data: edges } = trpc.graph.getEdges.useQuery(
    { nodeIds: graphNodeIds },
    { enabled: graphNodeIds.length > 0, refetchInterval: 5000 }
  );
  const initializedRef = useRef(false);

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
          graph: { dbId: note.id },
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
          graph: { dbId: reminder.id },
        },
      });
    });
  }, [reminders, nodeIds, addArtifact]);

  const primaryGraphNodeId = graphNodeIds[0];

  const { data: traverseResult } = trpc.graph.runQuery.useQuery(
    primaryGraphNodeId
      ? {
          kind: "traverse" as const,
          nodeId: primaryGraphNodeId,
          resource: "user",
        }
      : {
          kind: "traverse" as const,
          nodeId: "",
          resource: "user",
        },
    {
      enabled: Boolean(primaryGraphNodeId),
      refetchInterval: 15_000,
    }
  );

  useEffect(() => {
    if (!traverseResult) return;

    traverseResult.nodes.forEach((node: GraphNode, index: number) => {
      const ref = node.id.dbId ?? node.id.hgHash ?? node.id.uiId;
      if (!ref) {
        return;
      }
      const flowId = `knowledge-${ref}`;
      if (nodeIds.includes(flowId)) {
        return;
      }

      const props = (node.properties ?? {}) as Record<string, unknown>;
      const confidence =
        typeof props.confidence === "number"
          ? props.confidence
          : typeof props.accuracy === "number"
            ? props.accuracy
            : undefined;
      const summary =
        typeof props.content === "string" ? props.content : undefined;

      addArtifact({
        id: flowId,
        type: "knowledge",
        position: { x: 200 + index * 40, y: 200 + index * 40 },
        data: {
          type: "knowledge",
          label: node.label,
          kind: node.kind,
          summary,
          confidence,
          graph: {
            dbId: node.id.dbId,
            hgHash: node.id.hgHash,
          },
        } as ArtifactData,
      });
    });

    if (traverseResult.nodes.length > 0) {
      setTimeout(() => {
        autoLayout();
      }, 0);
    }
  }, [traverseResult, nodeIds, addArtifact, autoLayout]);

  const ensureGraphMapping = useCallback((dbId: string) => {
    const store = useMindscapeStore.getState();
    const existing = store.nodes.find((node) => node.data?.graph?.dbId === dbId);
    if (existing) {
      return;
    }
    const suffixMatch = store.nodes.find((node) => node.id.endsWith(dbId));
    if (suffixMatch) {
      store.updateArtifactData(suffixMatch.id, {
        graph: { dbId },
      } as Partial<ArtifactData>);
    }
  }, []);

  const findNodeIdByDbId = useCallback(
    (dbId: string) => {
      const mapped = nodes.find((node) => node.data?.graph?.dbId === dbId);
      if (mapped) {
        return mapped.id;
      }
      const suffixMatch = nodes.find((node) => node.id.endsWith(dbId));
      if (suffixMatch) {
        return suffixMatch.id;
      }
      return `note-${dbId}`;
    },
    [nodes]
  );

  const mapEdgeToFlow = useCallback(
    (edge: GraphEdge) => {
      ensureGraphMapping(edge.fromId);
      ensureGraphMapping(edge.toId);
      return {
        id: edge.id,
        source: findNodeIdByDbId(edge.fromId),
        target: findNodeIdByDbId(edge.toId),
        animated: true,
        style: { stroke: "rgba(255, 255, 255, 0.2)" },
      };
    },
    [ensureGraphMapping, findNodeIdByDbId]
  );

  // Sync Edges
  useEffect(() => {
    if (!edges) return;
    const newEdges = edges.map(mapEdgeToFlow);
    setEdges(newEdges);
  }, [edges, mapEdgeToFlow, setEdges]);

  trpc.graph.watchEdges.useSubscription(
    graphNodeIds.length > 0
      ? { nodeIds: graphNodeIds, resource: "user", pollMs: 5000 }
      : undefined,
    {
      enabled: graphNodeIds.length > 0,
      onData: ({ edges: incoming }) => {
        const mapped = incoming.map(mapEdgeToFlow);
        useMindscapeStore.setState((state) => {
          const merged = new Map(
            state.edges.map((edge) => [edge.id ?? `${edge.source}-${edge.target}`, edge])
          );
          for (const flowEdge of mapped) {
            merged.set(flowEdge.id, flowEdge);
          }
          return { edges: Array.from(merged.values()) };
        });
      },
    }
  );

  return null;
}
