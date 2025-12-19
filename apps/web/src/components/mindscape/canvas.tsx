"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type OnConnect,
  Panel,
  ReactFlow,
  type ReactFlowProps,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { inferRouterOutputs } from "@trpc/server";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useMindscapeActivations } from "@/hooks/use-mindscape-activations";
import { useLayoutSync } from "@/hooks/use-layout-sync";
import { useMindscapeTraversal } from "@/hooks/use-mindscape-traversal";
import { usePhysicsWorker } from "@/hooks/use-physics-worker";
import { hasWindow } from "@/lib/env/isomorphic";
import {
  type ArtifactData,
  type KnowledgeNodeData,
  RAG_DOC_CACHE_LIMIT,
  RAG_DOC_CACHE_TTL_MS,
  useMindscapeStore,
} from "@/store/mindscape";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";
import { MindscapeCommandPalette } from "./command-palette";
import { MindscapeDetailPanel } from "./detail-panel";
import { MindscapeInitializer } from "./initializer";
import { LivingEdge } from "./living-edge";
import { WorkflowManager } from "./monitor";
import { NodePanel } from "./node-panel";
import { ArtifactNode } from "./nodes/artifact-node";
import { BookmarkNode } from "./nodes/bookmark-node";
import { ChatNode } from "./nodes/chat-node";
import { CodeNode } from "./nodes/code-node";
import { ConceptNode } from "./nodes/concept-node";
import { DeploymentNode } from "./nodes/deployment-node";
import { DroidNode } from "./nodes/droid-node";
import { NodeErrorBoundary } from "./nodes/error-boundary";
import { IntegrationsNode } from "./nodes/integrations-node";
import { KnowledgeNode } from "./nodes/knowledge-node";
import { NoteNode } from "./nodes/note-node";
import { OrbNode } from "./nodes/orb-node";
import { PrivacyNode } from "./nodes/privacy-node";
import { ProfileNode } from "./nodes/profile-node";
import { ReminderNode } from "./nodes/reminder-node";
import { SettingsNode } from "./nodes/settings-node";
import { TerminalNode } from "./nodes/terminal-node";
import { TicketNode } from "./nodes/ticket-node";
import { TimerNode } from "./nodes/timer-node";
import { TodoNode } from "./nodes/todo-node";
import { WorkflowListNode } from "./nodes/workflow-list-node";
import { WorkflowNode } from "./nodes/workflow-node";
import {
  createSpawnNode,
  formatSpawnLabel,
  type MindscapeSearchParams,
  type MindscapeSpawnType,
  singletonSpawnTypes,
} from "./spawn";
import { MindscapeWorkflowDrawer } from "./workflow-drawer";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type GraphNode = RouterOutputs["graph"]["runQuery"]["nodes"][number];

// Helper type for accessing UnifiedNodeRef properties safely
type NodeIdRef = { uiId?: string; dbId?: string; hgHash?: string };

// Wrap each node component with error boundary
// Note: Using 'any' here because ReactFlow's internal NodeProps type system
// conflicts with our typed node components. The actual type safety is enforced
// at the individual node component level.
const wrapWithErrorBoundary =
  <T extends { id: string }>(Component: React.ComponentType<T>) =>
  (props: T) => (
    <NodeErrorBoundary nodeId={props.id}>
      <Component {...props} />
    </NodeErrorBoundary>
  );

const nodeTypes: NodeTypes = {
  orb: wrapWithErrorBoundary(OrbNode),
  artifact: wrapWithErrorBoundary(ArtifactNode),
  chat: wrapWithErrorBoundary(ChatNode),
  workflow: wrapWithErrorBoundary(WorkflowNode),
  terminal: wrapWithErrorBoundary(TerminalNode),
  droid: wrapWithErrorBoundary(DroidNode),
  note: wrapWithErrorBoundary(NoteNode),
  reminder: wrapWithErrorBoundary(ReminderNode),
  ticket: wrapWithErrorBoundary(TicketNode),
  code: wrapWithErrorBoundary(CodeNode),
  timer: wrapWithErrorBoundary(TimerNode),
  bookmark: wrapWithErrorBoundary(BookmarkNode),
  todo: wrapWithErrorBoundary(TodoNode),
  settings: wrapWithErrorBoundary(SettingsNode),
  privacy: wrapWithErrorBoundary(PrivacyNode),
  profile: wrapWithErrorBoundary(ProfileNode),
  integrations: wrapWithErrorBoundary(IntegrationsNode),
  workflowlist: wrapWithErrorBoundary(WorkflowListNode),
  deployment: wrapWithErrorBoundary(DeploymentNode),
  knowledge: wrapWithErrorBoundary(KnowledgeNode),
  concept: wrapWithErrorBoundary(ConceptNode),
};

const edgeTypes = {
  default: LivingEdge,
};

type MindscapeCanvasProps = Omit<
  ReactFlowProps,
  "nodes" | "edges" | "onNodesChange" | "onEdgesChange" | "onConnect"
> & {
  searchParams?: MindscapeSearchParams;
  onWorkflowNavigate?: (runId: string) => void;
  onRagDocNavigate?: (documentId: string) => void;
};

export function MindscapeCanvas({
  onWorkflowNavigate,
  onRagDocNavigate,
  ...props
}: MindscapeCanvasProps) {
  return (
    <ReactFlowProvider>
      <MindscapeCanvasInner
        {...props}
        onRagDocNavigate={onRagDocNavigate}
        onWorkflowNavigate={onWorkflowNavigate}
      />
    </ReactFlowProvider>
  );
}

function MindscapeCanvasInner({
  searchParams,
  onWorkflowNavigate,
  onRagDocNavigate,
  ...props
}: MindscapeCanvasProps) {
  const {
    nodes,
    edges,
    focusedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addArtifact,
    focusNode,
    setNodes,
    ragDocCache,
    cacheRagDoc,
    evictRagDoc,
    recordRagDocCacheHit,
    recordRagDocCacheMiss,
    ragDocCacheStats,
  } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      focusedNodeId: state.focusedNodeId,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      addArtifact: state.addArtifact,
      focusNode: state.focusNode,
      setNodes: state.setNodes,
      ragDocCache: state.ragDocCache,
      cacheRagDoc: state.cacheRagDoc,
      evictRagDoc: state.evictRagDoc,
      recordRagDocCacheHit: state.recordRagDocCacheHit,
      recordRagDocCacheMiss: state.recordRagDocCacheMiss,
      ragDocCacheStats: state.ragDocCacheStats,
    }))
  );

  // Listen for global Mindscape activations
  useMindscapeActivations();

  // Enable layout sync to database
  useLayoutSync();

  // Enable dynamic graph traversal
  const { isFetching: isTraversing } = useMindscapeTraversal();

  // Initialize Physics Worker
  usePhysicsWorker({
    nodes,
    edges,
    focusId: focusedNodeId,
    setNodes,
    active: false,
  });

  const [inspectedRunId, setInspectedRunId] = useState<string | null>(null);
  const ragDocFocusCooldownRef = useRef<{ id: string | null; at: number }>({
    id: null,
    at: 0,
  });

  const handleWorkflowInspect = useCallback((runId: string) => {
    setInspectedRunId(runId);
  }, []);

  const handleWorkflowDrawerClose = useCallback(() => {
    setInspectedRunId(null);
  }, []);

  const handleWorkflowNavigate = useCallback(
    (runId: string) => {
      if (onWorkflowNavigate) {
        onWorkflowNavigate(runId);
        return;
      }
      if (hasWindow()) {
        window.location.assign(`/workflow/${runId}`);
      }
    },
    [onWorkflowNavigate]
  );

  const handleNavigateToRagDoc = useCallback(
    (documentId: string) => {
      if (!documentId) {
        return;
      }
      const now = Date.now();
      const last = ragDocFocusCooldownRef.current;
      if (last.id === documentId && now - last.at < 600) {
        return;
      }
      ragDocFocusCooldownRef.current = { id: documentId, at: now };
      if (onRagDocNavigate) {
        onRagDocNavigate(documentId);
        return;
      }
      if (hasWindow()) {
        const url = new URL(window.location.href);
        url.searchParams.set("ragDoc", documentId);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    },
    [onRagDocNavigate]
  );

  const reactFlow = useReactFlow();
  const { mutateAsync: connectEdge } = trpc.graph.connect.useMutation();

  const [showRuntimeKnowledge, setShowRuntimeKnowledge] = useState(true);
  const [showRagKnowledge, setShowRagKnowledge] = useState(true);

  // TODO: Use focusedNode and highlightedRagDocDbId for RAG doc highlighting in future
  // const focusedNode = useMemo(
  //   () => nodes.find((candidate) => candidate.id === focusedNodeId) ?? null,
  //   [nodes, focusedNodeId]
  // );
  // const highlightedRagDocDbId = useMemo(() => {
  //   const artifact = focusedNode?.data as ArtifactData | undefined;
  //   if (
  //     artifact?.type === "knowledge" &&
  //     artifact.source === "rag" &&
  //     typeof artifact.graph?.dbId === "string"
  //   ) {
  //     return artifact.graph.dbId;
  //   }
  //   return null;
  // }, [focusedNode]);

  const ragDocCacheEntryCount = useMemo(
    () => Object.keys(ragDocCache).length,
    [ragDocCache]
  );
  const ragDocCacheLookupCount =
    ragDocCacheStats.hits + ragDocCacheStats.misses;
  const ragDocCacheHitRate =
    ragDocCacheLookupCount > 0
      ? Math.round((ragDocCacheStats.hits / ragDocCacheLookupCount) * 100)
      : 0;

  const { visibleNodes, visibleEdges } = useMemo(
    () => ({ visibleNodes: nodes, visibleEdges: edges }),
    [nodes, edges]
  );

  // Initialize with Orb if empty
  useEffect(() => {
    if (nodes.length === 0) {
      addArtifact({
        id: "singularity",
        type: "orb",
        position: { x: 0, y: 0 },
        data: { type: "orb", label: "Singularity" },
        draggable: false,
        selectable: false,
      });
    }
  }, [nodes.length, addArtifact]);

  const focusAndCenter = useCallback(
    (nodeId: string) => {
      focusNode(nodeId);
      requestAnimationFrame(() => {
        try {
          reactFlow.fitView({
            nodes: [{ id: nodeId }],
            duration: 400,
            padding: 0.4,
          });
        } catch (_error) {
          // Ignore fitView errors (e.g. node not mounted yet).
        }
      });
    },
    [focusNode, reactFlow]
  );

  const nodeIdQuery = searchParams?.nodeId;
  const spawnQuery = searchParams?.spawn;
  const ragDocQuery = searchParams?.ragDoc ?? null;

  const ragDocTargetNode = useMemo(() => {
    if (!ragDocQuery) {
      return null;
    }
    return nodes.find((node) => node.data?.graph?.dbId === ragDocQuery) ?? null;
  }, [nodes, ragDocQuery]);

  const cachedEntry = ragDocQuery ? ragDocCache[ragDocQuery] : undefined;
  const cachedRagDoc =
    cachedEntry && Date.now() - cachedEntry.cachedAt < RAG_DOC_CACHE_TTL_MS
      ? cachedEntry.data
      : undefined;

  const lastCacheRecordRef = useRef<{
    id: string;
    outcome: "hit" | "miss";
  } | null>(null);

  useEffect(() => {
    if (!ragDocQuery) {
      lastCacheRecordRef.current = null;
      return;
    }
    const outcome: "hit" | "miss" | null = cachedRagDoc
      ? "hit"
      : ragDocTargetNode
        ? null
        : "miss";
    if (!outcome) {
      return;
    }
    const prev = lastCacheRecordRef.current;
    if (prev && prev.id === ragDocQuery && prev.outcome === outcome) {
      return;
    }
    if (outcome === "hit") {
      recordRagDocCacheHit();
    } else {
      recordRagDocCacheMiss();
    }
    lastCacheRecordRef.current = { id: ragDocQuery, outcome };
  }, [
    cachedRagDoc,
    ragDocQuery,
    ragDocTargetNode,
    recordRagDocCacheHit,
    recordRagDocCacheMiss,
  ]);

  const lastLoggedStatsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    if (typeof process !== "undefined" && process.env.BUN_TEST === "1") {
      return;
    }
    if (!ragDocCacheStats) {
      return;
    }
    const snapshot = `${ragDocCacheStats.hits}-${ragDocCacheStats.misses}-${ragDocCacheStats.evictions}`;
    if (snapshot === lastLoggedStatsRef.current) {
      return;
    }
    lastLoggedStatsRef.current = snapshot;
    // console.debug("[Mindscape] RAG cache", ragDocCacheStats);
  }, [ragDocCacheStats]);

  const shouldHydrateRagDoc = Boolean(
    ragDocQuery && !ragDocTargetNode && !cachedRagDoc
  );

  const ragDocQueryInput =
    ragDocQuery && shouldHydrateRagDoc
      ? {
          kind: "traverse" as const,
          nodeId: ragDocQuery,
          direction: "both" as const,
          resource: "user",
          limit: 1,
        }
      : {
          kind: "traverse" as const,
          nodeId: "noop",
          direction: "both" as const,
          resource: "user",
          limit: 1,
        };

  const { data: ragDocGraph, isError: ragDocGraphError } =
    trpc.graph.runQuery.useQuery(ragDocQueryInput, {
      enabled: shouldHydrateRagDoc,
      retry: 1,
    });

  const spawnNodeFromType = useCallback(
    (spawnType: MindscapeSpawnType): string | null => {
      if (!(spawnType in nodeTypes)) {
        toast.info(`${formatSpawnLabel(spawnType)} node is not available yet.`);
        return null;
      }

      if (singletonSpawnTypes.includes(spawnType)) {
        const existing = nodes.find((node) => node.type === spawnType);
        if (existing) {
          focusAndCenter(existing.id);
          return existing.id;
        }
      }

      const newNode = createSpawnNode(spawnType, nodes.length);
      if (!newNode) {
        toast.error(`Unable to spawn ${formatSpawnLabel(spawnType)} yet.`);
        return null;
      }

      addArtifact(newNode);
      focusAndCenter(newNode.id);
      return newNode.id;
    },
    [nodes, addArtifact, focusAndCenter]
  );

  // Deep link focus (?nodeId=...)
  useEffect(() => {
    if (!nodeIdQuery) {
      return;
    }

    const target = nodes.find((node) => node.id === nodeIdQuery);
    if (!target) {
      return;
    }

    focusAndCenter(nodeIdQuery);
    clearSearchParams(["nodeId"]);
  }, [nodeIdQuery, nodes, focusAndCenter]);

  useEffect(() => {
    if (!(ragDocQuery && ragDocTargetNode)) {
      return;
    }
    focusAndCenter(ragDocTargetNode.id);
    clearSearchParams(["ragDoc"]);
  }, [ragDocQuery, ragDocTargetNode, focusAndCenter]);

  useEffect(() => {
    if (cachedEntry && !cachedRagDoc && ragDocQuery) {
      evictRagDoc(ragDocQuery);
    }
  }, [cachedEntry, cachedRagDoc, evictRagDoc, ragDocQuery]);

  // Spawn nodes via deep link (?spawn=...)
  useEffect(() => {
    if (!spawnQuery) {
      return;
    }

    spawnNodeFromType(spawnQuery);
    clearSearchParams(["spawn"]);
  }, [spawnQuery, spawnNodeFromType]);

  useEffect(() => {
    if (!(ragDocQuery && cachedRagDoc) || ragDocTargetNode) {
      return;
    }
    const derivedId = `rag-knowledge-${ragDocQuery}`;
    const exists = nodes.find((node) => node.id === derivedId);
    if (!exists) {
      addArtifact({
        id: derivedId,
        type: "knowledge",
        position: { x: 100, y: 100 },
        data: {
          ...cachedRagDoc,
          type: "knowledge",
          graph: {
            resource: cachedRagDoc.graph?.resource ?? "user",
            dbId: ragDocQuery,
            hgHash: cachedRagDoc.graph?.hgHash,
          },
          source: "rag",
        } as ArtifactData,
      });
    }
    focusAndCenter(exists?.id ?? derivedId);
    clearSearchParams(["ragDoc"]);
  }, [
    addArtifact,
    cachedRagDoc,
    focusAndCenter,
    nodes,
    ragDocQuery,
    ragDocTargetNode,
  ]);

  useEffect(() => {
    if (!(ragDocQuery && ragDocGraphError)) {
      return;
    }
    toast.error("Unable to load RAG document. Please retry.");
    if (!ragDocTargetNode) {
      clearSearchParams(["ragDoc"]);
    }
  }, [ragDocGraphError, ragDocQuery, ragDocTargetNode]);

  useEffect(() => {
    if (!ragDocQuery || ragDocTargetNode) {
      return;
    }
    if (!ragDocGraph || ragDocGraph.nodes.length === 0) {
      return;
    }
    const docNode = (ragDocGraph.nodes as GraphNode[]).find((node) => {
      const id = (node.id ?? {}) as NodeIdRef;
      return (
        id.dbId === ragDocQuery ||
        id.hgHash === ragDocQuery ||
        id.uiId === ragDocQuery
      );
    });
    if (!docNode) {
      toast.info("RAG document is not available in the graph yet.");
      clearSearchParams(["ragDoc"]);
      return;
    }

    const docNodeId = docNode.id as NodeIdRef;
    const props = (docNode.properties ?? {}) as Record<string, unknown>;
    const summary =
      typeof props.content === "string" ? props.content : undefined;
    const docDbId = docNodeId.dbId ?? ragDocQuery;
    const derivedId = `rag-knowledge-${docDbId}`;

    const exists = nodes.find((node) => node.id === derivedId);
    if (!exists) {
      const knowledgeData: KnowledgeNodeData = {
        type: "knowledge",
        label: docNode.label || "RAG Context",
        kind: docNode.kind,
        summary,
        source: "rag",
        graph: {
          resource: "user",
          dbId: docDbId,
          hgHash: docNodeId.hgHash,
        },
      };
      addArtifact({
        id: derivedId,
        type: "knowledge",
        position: { x: 100, y: 100 },
        data: knowledgeData as ArtifactData,
      });
      cacheRagDoc(docDbId, knowledgeData);
    }

    focusAndCenter(exists?.id ?? derivedId);
    clearSearchParams(["ragDoc"]);
  }, [
    addArtifact,
    cacheRagDoc,
    focusAndCenter,
    nodes,
    ragDocGraph,
    ragDocQuery,
    ragDocTargetNode,
  ]);

  const onConnectPersisting = useCallback<OnConnect>(
    async (connection) => {
      const beforeEdges = useMindscapeStore.getState().edges;
      const beforeCount = beforeEdges.length;

      onConnect(connection);

      const afterEdges = useMindscapeStore.getState().edges;
      const added = afterEdges.slice(beforeCount);
      const localEdge =
        added.find(
          (edge) =>
            edge.source === connection.source &&
            edge.target === connection.target
        ) ?? added[0];
      if (!localEdge) {
        return;
      }

      const rollback = () => {
        if (!localEdge?.id) {
          return;
        }
        useMindscapeStore.setState((state) => ({
          edges: state.edges.filter((edge) => edge.id !== localEdge.id),
        }));
      };

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const fromGraph = sourceNode?.data?.graph;
      const toGraph = targetNode?.data?.graph;
      const fromId = fromGraph?.dbId;
      const toId = toGraph?.dbId;
      const fromResource = fromGraph?.resource;
      const toResource = toGraph?.resource;

      if (!(fromId && toId)) {
        toast.error("Only graph-backed nodes can be linked.");
        rollback();
        return;
      }
      if (fromResource && toResource && fromResource !== toResource) {
        toast.error("Cannot link nodes from different resources.");
        rollback();
        return;
      }
      const resource = fromResource ?? toResource;
      if (!resource) {
        toast.error("Cannot link nodes without a resource.");
        rollback();
        return;
      }
      try {
        await connectEdge({
          fromId,
          toId,
          kind: "relates_to",
          resource,
        });
      } catch (_error) {
        toast.error("Failed to persist edge.");
        rollback();
      }
    },
    [connectEdge, nodes, onConnect]
  );

  return (
    <>
      <div className="relative h-screen w-full bg-void">
        <ReactFlow
          colorMode="dark"
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          edges={visibleEdges}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{
            minZoom: 0.8,
            maxZoom: 1.5,
            padding: 0.3,
          }}
          maxZoom={4}
          minZoom={0.1}
          nodes={visibleNodes}
          nodeTypes={nodeTypes}
          onConnect={onConnectPersisting}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          panOnDrag={true}
          panOnScroll={false}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag={true}
          {...props}
          onNodeClick={(_, node) => {
            // Auto-focus on click for immersive experience
            focusAndCenter(node.id);
          }}
        >
          <Background
            className="opacity-50"
            color="#333"
            gap={50}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <Controls className="border-white/10 bg-void-surface text-biolum" />
          <MiniMap
            className="border-white/10 bg-void-surface"
            maskColor="rgba(0, 0, 0, 0.6)"
            nodeColor="#A855F7"
          />
          <Panel
            className="text-biolum-dim text-xs uppercase tracking-widest"
            position="top-center"
          >
            Symbiotic Mindscape v0.1
          </Panel>
          <Panel
            className="rounded-full border border-white/10 bg-void-surface/80 px-4 py-2 text-[10px] text-biolum-faint uppercase tracking-widest"
            position="top-right"
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold text-xs">Knowledge</span>
              <label className="flex items-center gap-1">
                <input
                  aria-label="Toggle runtime knowledge"
                  checked={showRuntimeKnowledge}
                  className="h-3 w-3 accent-biolum"
                  onChange={(event) =>
                    setShowRuntimeKnowledge(event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="text-[10px]">Runtime</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  aria-label="Toggle RAG knowledge"
                  checked={showRagKnowledge}
                  className="h-3 w-3 accent-emerald-400"
                  onChange={(event) =>
                    setShowRagKnowledge(event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="text-[10px]">RAG</span>
              </label>
            </div>
          </Panel>
          <Panel
            className="rounded-full border border-white/10 bg-void-surface/80 px-4 py-2"
            position="bottom-right"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-[10px] text-biolum-dim uppercase tracking-widest">
                  {isTraversing ? (
                    <span className="animate-pulse text-emerald-400">
                      Traversing...
                    </span>
                  ) : (
                    "RAG Cache"
                  )}
                </span>
                <div className="flex gap-2">
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-biolum text-xs">
                      {ragDocCacheHitRate}%
                    </span>
                    <span className="text-[8px] text-biolum-dim">Hit Rate</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-biolum text-xs">
                      {ragDocCacheEntryCount}/{RAG_DOC_CACHE_LIMIT}
                    </span>
                    <span className="text-[8px] text-biolum-dim">Entries</span>
                  </div>
                </div>
              </div>
              {import.meta.env.DEV && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <dt className="text-biolum-dim">Hits</dt>
                  <dd className="text-right font-mono text-biolum">
                    {ragDocCacheStats.hits}
                  </dd>
                  <dt className="text-biolum-dim">Misses</dt>
                  <dd className="text-right font-mono text-biolum">
                    {ragDocCacheStats.misses}
                  </dd>
                  <dt className="text-biolum-dim">Evictions</dt>
                  <dd className="text-right font-mono text-biolum">
                    {ragDocCacheStats.evictions}
                  </dd>
                </dl>
              )}
            </div>
          </Panel>
          <MindscapeInitializer />
          <WorkflowManager />
        </ReactFlow>
        <MindscapeDetailPanel
          onWorkflowInspect={handleWorkflowInspect}
          onWorkflowNavigate={handleWorkflowNavigate}
        />
        <MindscapeWorkflowDrawer
          onClose={handleWorkflowDrawerClose}
          onNavigateFull={handleWorkflowNavigate}
          onNavigateToMindscape={(docId) => {
            handleNavigateToRagDoc(docId);
            handleWorkflowDrawerClose();
          }}
          runId={inspectedRunId}
        />
      </div>
      <MindscapeCommandPalette
        onFocus={focusAndCenter}
        onSpawn={spawnNodeFromType}
      />
      <NodePanel
        nodes={nodes}
        onFocus={focusAndCenter}
        onSpawn={spawnNodeFromType}
      />
    </>
  );
}

function clearSearchParams(keys: string[]) {
  if (!hasWindow()) {
    return;
  }

  const url = new URL(window.location.href);
  let changed = false;

  keys.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }
}
