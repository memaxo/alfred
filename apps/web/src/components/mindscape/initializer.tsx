import type { inferRouterOutputs } from "@trpc/server";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  type ArtifactData,
  type KnowledgeNodeData,
  useMindscapeStore,
} from "@/store/mindscape";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";
import { tierConfig } from "./spawn";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type NoteListItem = RouterOutputs["note"]["list"][number];
type DueReminderItem = RouterOutputs["remind"]["due"][number];
type GraphEdge = RouterOutputs["graph"]["getEdges"][number];
type GraphNode = RouterOutputs["graph"]["runQuery"]["nodes"][number];

// Helper type for accessing UnifiedNodeRef properties safely
type NodeIdRef = { uiId?: string; dbId?: string; hgHash?: string };

const GRAPH_DBID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

export function MindscapeInitializer() {
  const { nodes, addArtifact, autoLayout, setEdges, cacheRagDoc } =
    useMindscapeStore(
      useShallow((state) => ({
        nodes: state.nodes,
        addArtifact: state.addArtifact,
        autoLayout: state.autoLayout,
        setEdges: state.setEdges,
        cacheRagDoc: state.cacheRagDoc,
      }))
    );

  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const graphNodeIds = useMemo(() => {
    const ids: string[] = [];
    for (const node of nodes) {
      const dbId = node.data?.graph?.dbId;
      if (typeof dbId === "string" && GRAPH_DBID_PATTERN.test(dbId)) {
        ids.push(dbId);
      }
    }
    return Array.from(new Set(ids));
  }, [nodes]);

  const { data: notes } = trpc.note.list.useQuery({ limit: 5 });
  const { data: reminders } = trpc.remind.due.useQuery({});
  const ensureMirrors = trpc.graph.ensureMirrors.useMutation();
  const { data: edges } = trpc.graph.getEdges.useQuery(
    { nodeIds: graphNodeIds },
    { enabled: graphNodeIds.length > 0, refetchInterval: 5000 }
  );
  const initializedRef = useRef(false);
  const droidInitializedRef = useRef(false);

  // Initialize with Chat Node after Orb is created
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    // Skip chat autospawn in tests or when explicitly disabled.
    // In Bun tests, `process.env` is set, while in the browser we rely on Vite's `import.meta.env`.
    const disableChatAutospawn =
      import.meta.env?.BUN_TEST === "1" ||
      import.meta.env?.MINDSCAPE_DISABLE_CHAT_AUTOSPAWN === "1" ||
      (typeof process !== "undefined" &&
        (process.env.BUN_TEST === "1" ||
          process.env.MINDSCAPE_DISABLE_CHAT_AUTOSPAWN === "1"));

    if (disableChatAutospawn) {
      // Skip chat autospawn in test or when explicitly disabled so
      // tests and lightweight environments can focus on graph behaviour.
      return;
    }

    const hasOrb = nodeIds.includes("singularity");
    // Check for any chat node to avoid duplicates on reload if persisted
    const hasChat = nodeIds.some((id) => {
      const node = useMindscapeStore.getState().nodes.find((n) => n.id === id);
      return node?.type === "chat";
    });

    if (hasOrb && !hasChat) {
      const chatId = nanoid();
      // Primary tier: radius 200, angle 0 (right of orb)
      const primaryRadius = tierConfig.primary.radius;
      addArtifact({
        id: chatId,
        type: "chat",
        position: { x: primaryRadius, y: 0 },
        data: {
          type: "chat",
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

  useEffect(() => {
    if (droidInitializedRef.current) {
      return;
    }
    const hasDroid = nodes.some((node) => node.type === "droid");
    if (hasDroid) {
      droidInitializedRef.current = true;
      return;
    }
    const hasOrb = nodeIds.includes("singularity");
    if (!hasOrb) {
      return;
    }

    // Primary tier: radius 200, angle PI (left of orb)
    const primaryRadius = tierConfig.primary.radius;
    addArtifact({
      id: "droid-exec",
      type: "droid",
      position: { x: -primaryRadius, y: 0 },
      data: {
        type: "droid",
        label: "Droid Exec",
        prompt: "",
        auto: "low",
        out: "text",
        status: "idle",
        log: [],
      },
    });
    droidInitializedRef.current = true;
  }, [nodes, nodeIds, addArtifact]);

  // Sync Notes
  useEffect(() => {
    if (!notes) {
      return;
    }

    // Secondary tier: radius 350, distributed around top-right quadrant
    const secondaryRadius = tierConfig.secondary.radius;
    let cancelled = false;

    void (async () => {
      const missing = notes.filter(
        (note) => !nodeIds.includes(`note-${note.id}`)
      );
      if (missing.length === 0) {
        return;
      }

      const ensured = await ensureMirrors.mutateAsync({
        resource: "user",
        entities: missing.map((note) => ({
          kind: "note" as const,
          id: note.id,
        })),
      });

      if (!ensured?.refs) {
        return;
      }

      const dbIdByEntityId = new Map(
        ensured.refs.map((entry) => [entry.entity.id, entry.ref.id.dbId])
      );

      missing.forEach((note: NoteListItem, index: number) => {
        const noteNodeId = `note-${note.id}`;
        if (nodeIds.includes(noteNodeId)) {
          return;
        }
        const dbId = dbIdByEntityId.get(note.id);
        if (!dbId) {
          return;
        }

        // Distribute notes in top-right quadrant (angle -PI/4 to PI/4)
        const angleOffset = -Math.PI / 4;
        const angleStep = Math.PI / 8;
        const angle = angleOffset + index * angleStep;

        if (cancelled) {
          return;
        }

        addArtifact({
          id: noteNodeId,
          type: "note",
          position: {
            x: Math.cos(angle) * secondaryRadius,
            y: Math.sin(angle) * secondaryRadius,
          },
          data: {
            type: "note",
            label: note.title?.trim() || "Untitled Note",
            noteId: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags,
            mode: "view",
            updatedAt: note.updatedAt?.toISOString?.() ?? undefined,
            graph: { resource: "user", dbId },
          },
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [notes, nodeIds, addArtifact, ensureMirrors]);

  // Sync Reminders
  useEffect(() => {
    if (!reminders) {
      return;
    }

    // Secondary tier: radius 350, distributed around top-left quadrant
    const secondaryRadius = tierConfig.secondary.radius;
    let cancelled = false;

    void (async () => {
      const missing = reminders.filter(
        (reminder) => !nodeIds.includes(`reminder-${reminder.id}`)
      );
      if (missing.length === 0) {
        return;
      }

      const ensured = await ensureMirrors.mutateAsync({
        resource: "user",
        entities: missing.map((reminder) => ({
          kind: "reminder" as const,
          id: reminder.id,
        })),
      });

      if (!ensured?.refs) {
        return;
      }

      const dbIdByEntityId = new Map(
        ensured.refs.map((entry) => [entry.entity.id, entry.ref.id.dbId])
      );

      missing.forEach((reminder: DueReminderItem, index: number) => {
        const reminderNodeId = `reminder-${reminder.id}`;
        if (nodeIds.includes(reminderNodeId)) {
          return;
        }
        const dbId = dbIdByEntityId.get(reminder.id);
        if (!dbId) {
          return;
        }

        const dueIso =
          reminder.due instanceof Date
            ? reminder.due.toISOString()
            : reminder.due;
        const isDue = dueIso ? new Date(dueIso).getTime() <= Date.now() : false;
        const status = reminder.firedAt ? "fired" : isDue ? "due" : "scheduled";

        // Distribute reminders in top-left quadrant (angle 3*PI/4 to 5*PI/4)
        const angleOffset = (3 * Math.PI) / 4;
        const angleStep = Math.PI / 8;
        const angle = angleOffset + index * angleStep;

        if (cancelled) {
          return;
        }

        addArtifact({
          id: reminderNodeId,
          type: "reminder",
          position: {
            x: Math.cos(angle) * secondaryRadius,
            y: Math.sin(angle) * secondaryRadius,
          },
          data: {
            type: "reminder",
            label: reminder.title || "Reminder",
            reminderId: reminder.id,
            title: reminder.title,
            due: dueIso,
            description: reminder.description ?? undefined,
            status,
            mode: "view",
            graph: { resource: "user", dbId },
          },
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [reminders, nodeIds, addArtifact, ensureMirrors]);

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

  const ragSeedText = useMemo(() => {
    if (notes && notes.length > 0) {
      const first = notes[0];
      const title = first.title?.trim();
      if (title && title.length > 0) {
        return title;
      }
      const content =
        typeof first.content === "string" ? first.content.trim() : "";
      if (content.length > 0) {
        return content.slice(0, 256);
      }
    }

    if (traverseResult?.nodes && traverseResult.nodes.length > 0) {
      const node = traverseResult.nodes[0] as GraphNode;
      const props = (node.properties ?? {}) as Record<string, unknown>;
      const summary =
        typeof props.content === "string" ? props.content.trim() : "";
      if (summary.length > 0) {
        return summary.slice(0, 256);
      }
      if (node.label && node.label.length > 0) {
        return node.label;
      }
    }

    return "";
  }, [notes, traverseResult]);

  const { data: ragResult } = trpc.graph.runQuery.useQuery(
    ragSeedText
      ? {
          kind: "semantic" as const,
          text: ragSeedText,
          topK: 5,
          preferRag: true,
        }
      : {
          kind: "semantic" as const,
          text: "",
          topK: 0,
          preferRag: true,
        },
    {
      enabled: Boolean(ragSeedText),
      refetchInterval: 60_000,
    }
  );

  useEffect(() => {
    if (!traverseResult?.nodes) {
      return;
    }

    let added = false;
    traverseResult.nodes.forEach((node: GraphNode, index: number) => {
      const nodeId = node.id as NodeIdRef;
      const ref = nodeId.dbId ?? nodeId.hgHash ?? nodeId.uiId;
      if (!ref) {
        return;
      }
      const flowId = `knowledge-${ref}`;
      if (nodeIds.includes(flowId)) {
        return;
      }

      // ... props extraction ...
      const props = (node.properties ?? {}) as Record<string, unknown>;
      const confidence =
        typeof props.confidence === "number"
          ? props.confidence
          : typeof props.accuracy === "number"
            ? props.accuracy
            : undefined;
      const archived =
        typeof props.archived === "string" ? props.archived : undefined;
      const summary =
        typeof props.content === "string" ? props.content : undefined;
      const runId =
        typeof props.executionId === "string" && props.executionId.length > 0
          ? props.executionId
          : typeof props.runId === "string" && props.runId.length > 0
            ? props.runId
            : typeof props.workflowRunId === "string" &&
                props.workflowRunId.length > 0
              ? props.workflowRunId
              : undefined;

      // Tertiary tier: radius 500, distributed around bottom quadrant
      const tertiaryRadius = tierConfig.tertiary.radius;
      const angleOffset = Math.PI / 2; // Start at bottom
      const angleStep = Math.PI / 6;
      const angle = angleOffset + index * angleStep;

      addArtifact({
        id: flowId,
        type: "knowledge",
        position: {
          x: Math.cos(angle) * tertiaryRadius,
          y: Math.sin(angle) * tertiaryRadius,
        },
        data: {
          type: "knowledge",
          label: node.label,
          kind: node.kind,
          summary,
          confidence,
          archived,
          source: "runtime",
          runId,
          graph: {
            resource: "user",
            dbId: nodeId.dbId,
            hgHash: nodeId.hgHash,
          },
        } as ArtifactData,
      });
      added = true;
    });

    if (added && traverseResult.nodes && traverseResult.nodes.length > 0) {
      setTimeout(() => {
        autoLayout();
      }, 0);
    }
  }, [traverseResult, nodeIds, addArtifact, autoLayout]);

  useEffect(() => {
    if (!ragResult?.nodes) {
      return;
    }

    let added = false;
    ragResult.nodes.forEach((node: GraphNode, index: number) => {
      const nodeId = node.id as NodeIdRef;
      const ref = nodeId.dbId ?? nodeId.hgHash ?? nodeId.uiId;
      if (!ref) {
        return;
      }

      const flowId = `rag-knowledge-${ref}`;
      if (nodeIds.includes(flowId)) {
        return;
      }

      const props = (node.properties ?? {}) as Record<string, unknown>;
      const summary =
        typeof props.content === "string" ? props.content : undefined;

      const knowledgeData: KnowledgeNodeData = {
        type: "knowledge",
        label: node.label || "RAG Context",
        kind: node.kind,
        summary,
        source: "rag",
        graph: {
          resource: "user",
          dbId: nodeId.dbId,
          hgHash: nodeId.hgHash,
        },
      };

      // Tertiary tier: radius 500, distributed around bottom-right
      const tertiaryRadius = tierConfig.tertiary.radius;
      const angleOffset = Math.PI / 3; // Start at bottom-right
      const angleStep = Math.PI / 8;
      const angle = angleOffset + index * angleStep;

      addArtifact({
        id: flowId,
        type: "knowledge",
        position: {
          x: Math.cos(angle) * tertiaryRadius,
          y: Math.sin(angle) * tertiaryRadius,
        },
        data: knowledgeData as ArtifactData,
      });
      if (nodeId.dbId) {
        cacheRagDoc(nodeId.dbId, knowledgeData);
      }
      added = true;
    });

    if (added && ragResult.nodes && ragResult.nodes.length > 0) {
      setTimeout(() => {
        autoLayout();
      }, 0);
    }
  }, [ragResult, nodeIds, addArtifact, autoLayout, cacheRagDoc]);

  const dbIdToFlowId = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      const dbId = node.data?.graph?.dbId;
      if (typeof dbId === "string" && dbId.length > 0) {
        map.set(dbId, node.id);
      }
    }
    return map;
  }, [nodes]);

  const mapEdgeToFlow = useCallback(
    (edge: GraphEdge) => {
      const source = dbIdToFlowId.get(edge.fromId);
      const target = dbIdToFlowId.get(edge.toId);
      if (!(source && target)) {
        return null;
      }
      const isExplains = edge.kind === "explains";
      return {
        id: edge.id,
        source,
        target,
        animated: !isExplains,
        data: {
          kind: edge.kind,
          fromDbId: edge.fromId,
          toDbId: edge.toId,
        },
        style: isExplains
          ? {
              stroke: "rgba(16, 185, 129, 0.6)",
              strokeDasharray: "4 2",
              strokeWidth: 1.5,
            }
          : { stroke: "rgba(255, 255, 255, 0.2)" },
      };
    },
    [dbIdToFlowId]
  );

  // Sync Edges
  useEffect(() => {
    if (!edges) {
      return;
    }
    const newEdges = edges
      .map(mapEdgeToFlow)
      .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));
    setEdges(newEdges);
  }, [edges, mapEdgeToFlow, setEdges]);

  trpc.graph.watchEdges.useSubscription(
    { nodeIds: graphNodeIds, resource: "user", pollMs: 5000 },
    {
      enabled: graphNodeIds.length > 0,
      onData: ({ edges: incoming }) => {
        const mapped = incoming
          .map(mapEdgeToFlow)
          .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));
        useMindscapeStore.setState((state) => {
          const merged = new Map(
            state.edges.map((edge) => [
              edge.id ?? `${edge.source}-${edge.target}`,
              edge,
            ])
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
