import type { SearchReceipt } from "@alfred/type";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import type { z } from "zod";
import { create } from "zustand";
import { getLayoutedElements, getSemanticLayoutedElements } from "@/lib/layout";
import {
  type artifactNodeDataSchema,
  type bookmarkNodeDataSchema,
  type chatNodeDataSchema,
  type codeNodeDataSchema,
  type conceptNodeDataSchema,
  type deploymentNodeDataSchema,
  type droidNodeDataSchema,
  getNodeDataSchema,
  type integrationsNodeDataSchema,
  type knowledgeNodeDataSchema,
  type noteNodeDataSchema,
  type orbNodeDataSchema,
  type privacyNodeDataSchema,
  type profileNodeDataSchema,
  type reminderNodeDataSchema,
  type settingsNodeDataSchema,
  type terminalNodeDataSchema,
  type ticketNodeDataSchema,
  type timerNodeDataSchema,
  type todoNodeDataSchema,
  type workflowListNodeDataSchema,
  type workflowNodeDataSchema,
} from "./mindscape.schemas";

export type ArtifactType =
  | "chat"
  | "workflow"
  | "terminal"
  | "droid"
  | "note"
  | "reminder"
  | "ticket"
  | "code"
  | "timer"
  | "bookmark"
  | "todo"
  | "settings"
  | "privacy"
  | "profile"
  | "integrations"
  | "workflowlist"
  | "deployment"
  | "artifact"
  | "orb"
  | "knowledge"
  | "concept";

/**
 * Individual node data types inferred from Zod schemas.
 */
export type CodeNodeData = z.infer<typeof codeNodeDataSchema> & {
  type: "code";
};
export type ChatNodeData = z.infer<typeof chatNodeDataSchema> & {
  type: "chat";
};
export type WorkflowNodeData = z.infer<typeof workflowNodeDataSchema> & {
  type: "workflow";
};
export type TicketNodeData = z.infer<typeof ticketNodeDataSchema> & {
  type: "ticket";
};
export type ReminderNodeData = z.infer<typeof reminderNodeDataSchema> & {
  type: "reminder";
};
export type NoteNodeData = z.infer<typeof noteNodeDataSchema> & {
  type: "note";
};
export type TimerNodeData = z.infer<typeof timerNodeDataSchema> & {
  type: "timer";
};
export type BookmarkNodeData = z.infer<typeof bookmarkNodeDataSchema> & {
  type: "bookmark";
};
export type TodoNodeData = z.infer<typeof todoNodeDataSchema> & {
  type: "todo";
};
export type SettingsNodeData = z.infer<typeof settingsNodeDataSchema> & {
  type: "settings";
};
export type PrivacyNodeData = z.infer<typeof privacyNodeDataSchema> & {
  type: "privacy";
};
export type ProfileNodeData = z.infer<typeof profileNodeDataSchema> & {
  type: "profile";
};
export type IntegrationsNodeData = z.infer<
  typeof integrationsNodeDataSchema
> & {
  type: "integrations";
};
export type WorkflowListNodeData = z.infer<
  typeof workflowListNodeDataSchema
> & {
  type: "workflowlist";
};
export type DeploymentNodeData = z.infer<typeof deploymentNodeDataSchema> & {
  type: "deployment";
};
export type TerminalNodeData = z.infer<typeof terminalNodeDataSchema> & {
  type: "terminal";
};
export type ArtifactNodeData = z.infer<typeof artifactNodeDataSchema> & {
  type: "artifact";
};
export type OrbNodeData = z.infer<typeof orbNodeDataSchema> & { type: "orb" };
export type KnowledgeNodeData = z.infer<typeof knowledgeNodeDataSchema> & {
  type: "knowledge";
};
export type ConceptNodeData = z.infer<typeof conceptNodeDataSchema> & {
  type: "concept";
};
export type DroidNodeData = z.infer<typeof droidNodeDataSchema> & {
  type: "droid";
};

/**
 * Discriminated union of all artifact data types.
 * The 'type' field determines which schema applies.
 */
export type ArtifactData =
  | CodeNodeData
  | ChatNodeData
  | WorkflowNodeData
  | TicketNodeData
  | ReminderNodeData
  | NoteNodeData
  | TimerNodeData
  | BookmarkNodeData
  | TodoNodeData
  | SettingsNodeData
  | PrivacyNodeData
  | ProfileNodeData
  | IntegrationsNodeData
  | WorkflowListNodeData
  | DeploymentNodeData
  | DroidNodeData
  | TerminalNodeData
  | ArtifactNodeData
  | OrbNodeData
  | KnowledgeNodeData
  | ConceptNodeData;

type CachedRagDocEntry = {
  data: KnowledgeNodeData;
  cachedAt: number;
};

type ContextCacheEntry = {
  receipt?: SearchReceipt;
  phase?: "cache" | "scan" | "web" | "bundle";
  source?: "cache" | "handoff" | "scan";
  updatedAt: number;
};

type FeedbackIntent = "positive" | "negative";

type FeedbackEntry = {
  intent: FeedbackIntent;
  updatedAt: number;
};

const resolvePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

export const RAG_DOC_CACHE_LIMIT = resolvePositiveNumber(
  import.meta.env?.VITE_MINDSCAPE_RAG_CACHE_LIMIT,
  50
);

export const RAG_DOC_CACHE_TTL_MS = resolvePositiveNumber(
  import.meta.env?.VITE_MINDSCAPE_RAG_CACHE_TTL_MS,
  5 * 60 * 1000
);

type MindscapeState = {
  nodes: Node<ArtifactData>[];
  edges: Edge[];
  activeEdges: Set<string>;
  highlightedEdgeIds: Set<string>;
  focusedNodeId: string | null;
  isSpaceMode: boolean;
  ragDocCache: Record<string, CachedRagDocEntry>;
  ragDocCacheStats: {
    hits: number;
    misses: number;
    evictions: number;
  };
  contextCache: Record<string, ContextCacheEntry>;
  feedbackByNode: Record<string, FeedbackEntry>;

  // React Flow actions
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Mindscape actions
  addArtifact: (node: Node<ArtifactData>) => void;
  removeArtifact: (nodeId: string) => void;
  updateArtifactData: (nodeId: string, data: Partial<ArtifactData>) => void;
  focusNode: (nodeId: string | null) => void;
  setSpaceMode: (isSpaceMode: boolean) => void;
  setNodes: (
    nodes:
      | Node<ArtifactData>[]
      | ((prev: Node<ArtifactData>[]) => Node<ArtifactData>[])
  ) => void;
  setEdges: (edges: Edge[]) => void;
  setHighlightedEdges: (edgeIds: string[]) => void;
  triggerEdgeActivity: (edgeId: string, durationMs?: number) => void;
  triggerNodeActivity: (
    nodeId: string,
    type: "input" | "output" | "processing"
  ) => void;
  autoLayout: () => void;
  cacheRagDoc: (dbId: string, data: KnowledgeNodeData) => void;
  evictRagDoc: (dbId: string) => void;
  recordRagDocCacheHit: () => void;
  recordRagDocCacheMiss: () => void;
  recordContextReceipt: (
    nodeId: string,
    entry: Partial<Omit<ContextCacheEntry, "updatedAt">> & {
      receipt?: SearchReceipt;
    }
  ) => void;
  clearContextReceipt: (nodeId: string) => void;
  recordFeedback: (nodeId: string, intent: FeedbackIntent) => void;
};

import { persist } from "zustand/middleware";
import { queueRagCacheMetric } from "@/lib/mindscape/telemetry";

export const useMindscapeStore = create<MindscapeState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      activeEdges: new Set(),
      highlightedEdgeIds: new Set(),
      focusedNodeId: null,
      isSpaceMode: false,
      ragDocCache: {},
      ragDocCacheStats: {
        hits: 0,
        misses: 0,
        evictions: 0,
      },
      contextCache: {},
      feedbackByNode: {},

      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes) as Node<ArtifactData>[],
        });
      },
      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      onConnect: (connection: Connection) => {
        set({
          edges: addEdge(connection, get().edges),
        });
      },

      addArtifact: (node) => {
        set((state) => {
          if (state.nodes.some((n) => n.id === node.id)) {
            return state;
          }
          return {
            nodes: [...state.nodes, node],
          };
        });
      },
      removeArtifact: (nodeId) => {
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== nodeId),
          edges: state.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          ),
        }));
      },
      updateArtifactData: (nodeId, data) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node) {
          return;
        }

        // Determine node type from node.type or node.data.type
        const nodeType = node.type || (node.data as ArtifactData).type;
        const schema = getNodeDataSchema(nodeType);

        // Merge existing data with new data
        const mergedGraph =
          data.graph !== undefined
            ? { ...(node.data.graph ?? {}), ...data.graph }
            : node.data.graph;
        const mergedData = {
          ...node.data,
          ...data,
          graph: mergedGraph,
        };

        // Validate merged data (schema fields are optional, supporting partial updates)
        const result = schema.safeParse(mergedData);

        if (!result.success) {
          return;
        }

        // Update only if validation succeeds
        const validatedData = result.data as Record<string, unknown>;
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                data: { ...n.data, ...validatedData } as ArtifactData,
              };
            }
            return n;
          }),
        }));
      },
      focusNode: (nodeId) => {
        set({ focusedNodeId: nodeId });
      },
      setSpaceMode: (isSpaceMode) => {
        set({ isSpaceMode });
      },
      setNodes: (nodesOrUpdater) => {
        set((state) => {
          const newNodes =
            typeof nodesOrUpdater === "function"
              ? nodesOrUpdater(state.nodes)
              : nodesOrUpdater;
          return { nodes: newNodes };
        });
      },
      setEdges: (edges) => {
        set((state) => {
          if (edges.length === state.edges.length) {
            const allMatch = edges.every((e, i) => e.id === state.edges[i]?.id);
            if (allMatch) return state;
          }
          return { edges };
        });
      },
      setHighlightedEdges: (edgeIds) => {
        set({ highlightedEdgeIds: new Set(edgeIds) });
      },
      triggerEdgeActivity: (edgeId, durationMs = 2000) => {
        set((state) => {
          const next = new Set(state.activeEdges);
          next.add(edgeId);
          return { activeEdges: next };
        });

        setTimeout(() => {
          set((state) => {
            const next = new Set(state.activeEdges);
            next.delete(edgeId);
            return { activeEdges: next };
          });
        }, durationMs);
      },
      triggerNodeActivity: (nodeId, _type) => {
        const { edges, triggerEdgeActivity } = get();
        // Find all connected edges
        const connectedEdges = edges.filter(
          (e) => e.source === nodeId || e.target === nodeId
        );
        // Pulse them
        connectedEdges.forEach((edge) => {
          triggerEdgeActivity(edge.id, 1000);
        });
      },
      autoLayout: () => {
        const { nodes, edges, focusedNodeId } = get();
        const shouldUseSemantic =
          edges.length > 0 ||
          nodes.some((node) => Boolean(node.data?.graph?.dbId));
        const layoutedNodes = shouldUseSemantic
          ? getSemanticLayoutedElements(nodes, edges, {
              focusId: focusedNodeId,
            })
          : getLayoutedElements(nodes, edges);
        set({ nodes: layoutedNodes });
      },
      cacheRagDoc: (dbId, data) => {
        if (!dbId) {
          return;
        }
        set((state) => {
          const now = Date.now();
          const next: Record<string, CachedRagDocEntry> = {
            ...state.ragDocCache,
            [dbId]: {
              data,
              cachedAt: now,
            },
          };

          let evictions = 0;
          for (const key of Object.keys(next)) {
            const entry = next[key];
            if (!entry) {
              continue;
            }
            if (now - entry.cachedAt > RAG_DOC_CACHE_TTL_MS) {
              delete next[key];
              evictions += 1;
            }
          }

          const keys = Object.keys(next);
          if (keys.length > RAG_DOC_CACHE_LIMIT) {
            keys
              .sort(
                (a, b) => (next[a]?.cachedAt ?? 0) - (next[b]?.cachedAt ?? 0)
              )
              .slice(0, keys.length - RAG_DOC_CACHE_LIMIT)
              .forEach((key) => {
                delete next[key];
                evictions += 1;
              });
          }

          const nextState: Partial<MindscapeState> = {
            ragDocCache: next,
            ragDocCacheStats:
              evictions > 0
                ? {
                    ...state.ragDocCacheStats,
                    evictions: state.ragDocCacheStats.evictions + evictions,
                  }
                : state.ragDocCacheStats,
          };
          if (evictions > 0) {
            queueRagCacheMetric("eviction", evictions);
          }
          return nextState;
        });
      },
      evictRagDoc: (dbId) => {
        if (!dbId) {
          return;
        }
        set((state) => {
          if (!state.ragDocCache[dbId]) {
            return state;
          }
          const next = { ...state.ragDocCache };
          delete next[dbId];
          queueRagCacheMetric("eviction");
          return {
            ragDocCache: next,
            ragDocCacheStats: {
              ...state.ragDocCacheStats,
              evictions: state.ragDocCacheStats.evictions + 1,
            },
          } as Partial<MindscapeState>;
        });
      },
      recordRagDocCacheHit: () => {
        set((state) => ({
          ragDocCacheStats: {
            ...state.ragDocCacheStats,
            hits: state.ragDocCacheStats.hits + 1,
          },
        }));
        queueRagCacheMetric("hit");
      },
      recordRagDocCacheMiss: () => {
        set((state) => ({
          ragDocCacheStats: {
            ...state.ragDocCacheStats,
            misses: state.ragDocCacheStats.misses + 1,
          },
        }));
        queueRagCacheMetric("miss");
      },
      recordContextReceipt: (nodeId, entry) => {
        if (!nodeId) {
          return;
        }
        set((state) => ({
          contextCache: {
            ...state.contextCache,
            [nodeId]: {
              ...(state.contextCache[nodeId] ?? {}),
              ...entry,
              updatedAt: Date.now(),
            },
          },
        }));
      },
      clearContextReceipt: (nodeId) => {
        if (!nodeId) {
          return;
        }
        set((state) => {
          if (!state.contextCache[nodeId]) {
            return state;
          }
          const next = { ...state.contextCache };
          delete next[nodeId];
          return { contextCache: next } as Partial<MindscapeState>;
        });
      },
      recordFeedback: (nodeId, intent) => {
        if (!nodeId) {
          return;
        }
        set((state) => ({
          feedbackByNode: {
            ...state.feedbackByNode,
            [nodeId]: { intent, updatedAt: Date.now() },
          },
        }));
      },
    }),
    {
      name: "mindscape-storage-v2",
      partialize: (state) => ({
        nodes: state.nodes.map(sanitizeNodeForPersist),
        edges: state.edges,
        isSpaceMode: state.isSpaceMode,
        focusedNodeId: state.focusedNodeId,
        ragDocCache: state.ragDocCache,
        ragDocCacheStats: state.ragDocCacheStats,
        contextCache: state.contextCache,
        feedbackByNode: state.feedbackByNode,
      }),
    }
  )
);

function sanitizeNodeForPersist(node: Node<ArtifactData>): Node<ArtifactData> {
  const sanitizedData = sanitizeNodeData(node);
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    dragging: false,
    data: sanitizedData,
    draggable: node.draggable,
    height: node.height,
    width: node.width,
    selectable: node.selectable,
  } as Node<ArtifactData>;
}

function sanitizeNodeData(node: Node<ArtifactData>): ArtifactData {
  const data = (node.data ??
    ({ label: node.id } as ArtifactData)) as ArtifactData;

  if (
    node.type === "chat" &&
    "messages" in data &&
    Array.isArray((data as ChatNodeData).messages)
  ) {
    const trimmed = (data as ChatNodeData).messages?.slice(-10);
    return { ...data, messages: trimmed } as ArtifactData;
  }

  return data;
}

import { hasWindow } from "@/lib/env/isomorphic";

declare global {
  interface Window {
    __MINDSCAPE_STORE__?: typeof useMindscapeStore;
  }
}

if (hasWindow() && !window.__MINDSCAPE_STORE__) {
  window.__MINDSCAPE_STORE__ = useMindscapeStore;
}
