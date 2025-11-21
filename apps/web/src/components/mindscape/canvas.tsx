"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeProps,
  type NodeTypes,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type ReactFlowProps,
  type OnConnect,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import type { inferRouterOutputs } from "@trpc/server";
import {
  useMindscapeStore,
  type ArtifactData,
  type KnowledgeNodeData,
} from "@/store/mindscape";
import { MindscapeInitializer } from "./initializer";
import { ArtifactNode } from "./nodes/artifact-node";
import { ChatNode } from "./nodes/chat-node";
import { CodeNode } from "./nodes/code-node";
import { NodeErrorBoundary } from "./nodes/error-boundary";
import { NoteNode } from "./nodes/note-node";
import { OrbNode } from "./nodes/orb-node";
import { ReminderNode } from "./nodes/reminder-node";
import { TimerNode } from "./nodes/timer-node";
import { BookmarkNode } from "./nodes/bookmark-node";
import { TodoNode } from "./nodes/todo-node";
import { TerminalNode } from "./nodes/terminal-node";
import { TicketNode } from "./nodes/ticket-node";
import { WorkflowNode } from "./nodes/workflow-node";
import { SettingsNode } from "./nodes/settings-node";
import { PrivacyNode } from "./nodes/privacy-node";
import { ProfileNode } from "./nodes/profile-node";
import { IntegrationsNode } from "./nodes/integrations-node";
import { WorkflowListNode } from "./nodes/workflow-list-node";
import { DeploymentNode } from "./nodes/deployment-node";
import { WorkflowManager } from "./workflow-manager";
import { KnowledgeNode } from "./nodes/knowledge-node";
import {
  createSpawnNode,
  formatSpawnLabel,
  singletonSpawnTypes,
  type MindscapeSpawnType,
  type MindscapeSearchParams,
} from "./spawn";
import { MindscapeCommandPalette } from "./command-palette";
import { MindscapeDetailPanel } from "./detail-panel";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type GraphNode = RouterOutputs["graph"]["runQuery"]["nodes"][number];

// Wrap each node component with error boundary
const wrapWithErrorBoundary = (Component: React.ComponentType<NodeProps>) =>
  (props: NodeProps) => (
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
};

type MindscapeCanvasProps = Omit<
  ReactFlowProps,
  "nodes" | "edges" | "onNodesChange" | "onEdgesChange" | "onConnect"
> & {
  searchParams?: MindscapeSearchParams;
};

export function MindscapeCanvas(props: MindscapeCanvasProps) {
  return (
    <ReactFlowProvider>
      <MindscapeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function MindscapeCanvasInner({ searchParams, ...props }: MindscapeCanvasProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addArtifact,
    focusNode,
    ragDocCache,
    cacheRagDoc,
  } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      addArtifact: state.addArtifact,
      focusNode: state.focusNode,
      ragDocCache: state.ragDocCache,
      cacheRagDoc: state.cacheRagDoc,
    }))
  );

  const reactFlow = useReactFlow<ArtifactData>();
  const { mutateAsync: connectEdge } = trpc.graph.connect.useMutation();

  const [showRuntimeKnowledge, setShowRuntimeKnowledge] = useState(true);
  const [showRagKnowledge, setShowRagKnowledge] = useState(true);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const allowedNodeIds = new Set<string>();

    const filteredNodes = nodes.filter((node) => {
      if (node.type !== "knowledge") {
        allowedNodeIds.add(node.id);
        return true;
      }
      const source = (node.data as ArtifactData | undefined)?.source;
      if (source === "rag") {
        if (!showRagKnowledge) {
          return false;
        }
        allowedNodeIds.add(node.id);
        return true;
      }
      // Default and "runtime"/"user" fall under runtime toggle
      if (!showRuntimeKnowledge) {
        return false;
      }
      allowedNodeIds.add(node.id);
      return true;
    });

    const filteredEdges = edges.filter(
      (edge) =>
        allowedNodeIds.has(edge.source ?? "") &&
        allowedNodeIds.has(edge.target ?? "")
    );

    return { visibleNodes: filteredNodes, visibleEdges: filteredEdges };
  }, [nodes, edges, showRuntimeKnowledge, showRagKnowledge]);

  // Initialize with Orb if empty
  useEffect(() => {
    if (nodes.length === 0) {
      addArtifact({
        id: "singularity",
        type: "orb",
        position: { x: 0, y: 0 },
        data: { label: "Singularity" },
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
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn("Mindscape focus failed", error);
          }
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

  const cachedRagDoc = ragDocQuery ? ragDocCache[ragDocQuery] : undefined;

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

  const {
    data: ragDocGraph,
    isError: ragDocGraphError,
  } = trpc.graph.runQuery.useQuery(
    ragDocQueryInput,
    {
      enabled: shouldHydrateRagDoc,
      retry: 1,
    }
  );

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
    if (!ragDocQuery || !ragDocTargetNode) {
      return;
    }
    focusAndCenter(ragDocTargetNode.id);
    clearSearchParams(["ragDoc"]);
  }, [ragDocQuery, ragDocTargetNode, focusAndCenter]);

  // Spawn nodes via deep link (?spawn=...)
  useEffect(() => {
    if (!spawnQuery) {
      return;
    }

    spawnNodeFromType(spawnQuery);
    clearSearchParams(["spawn"]);
  }, [spawnQuery, spawnNodeFromType]);

  useEffect(() => {
    if (!ragDocQuery || !cachedRagDoc || ragDocTargetNode) {
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
    if (!ragDocQuery || !ragDocGraphError) {
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
      const id = node.id ?? {};
      return (
        id?.dbId === ragDocQuery ||
        id?.hgHash === ragDocQuery ||
        id?.uiId === ragDocQuery
      );
    });
    if (!docNode) {
      toast.info("RAG document is not available in the graph yet.");
      clearSearchParams(["ragDoc"]);
      return;
    }

  const props = (docNode.properties ?? {}) as Record<string, unknown>;
  const summary =
    typeof props.content === "string" ? props.content : undefined;
  const docDbId = docNode.id?.dbId ?? ragDocQuery;
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
        dbId: docDbId,
        hgHash: docNode.id?.hgHash,
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
      onConnect(connection);
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const fromId = sourceNode?.data?.graph?.dbId;
      const toId = targetNode?.data?.graph?.dbId;
      if (!(fromId && toId)) {
        if (import.meta.env.DEV) {
          console.warn(
            "Skipping graph.connect because one or both nodes lack dbId mappings",
            connection
          );
        }
        return;
      }
      try {
        await connectEdge({
          fromId,
          toId,
          kind: "relates_to",
          resource: "user",
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("graph.connect failed", error);
        }
      }
    },
    [connectEdge, nodes, onConnect]
  );

  return (
    <>
      <div className="relative h-screen w-full bg-[oklch(0.05_0_0)]">
        <ReactFlow
          colorMode="dark"
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          edges={visibleEdges}
          fitView
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
            className="rounded-full border border-white/10 bg-void-surface/80 px-4 py-2 text-[10px] uppercase tracking-widest text-biolum-faint"
            position="top-right"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold">Knowledge</span>
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
          <MindscapeInitializer />
          <WorkflowManager />
        </ReactFlow>
        <MindscapeDetailPanel />
      </div>
      <MindscapeCommandPalette
        nodes={nodes}
        onFocus={focusAndCenter}
        onSpawn={spawnNodeFromType}
      />
    </>
  );
}

function clearSearchParams(keys: string[]) {
  if (typeof window === "undefined") {
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
