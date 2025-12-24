"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowProps,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDeepLinks } from "@/hooks/use-deep-links";
import { useEdgePersistence } from "@/hooks/use-edge-persistence";
import { useLayoutSync } from "@/hooks/use-layout-sync";
import { useMindscapeActivations } from "@/hooks/use-mindscape-activations";
import { useMindscapeTraversal } from "@/hooks/use-mindscape-traversal";
import { usePhysicsWorker } from "@/hooks/use-physics-worker";
import { useRagCache } from "@/hooks/use-rag-cache";
import { hasWindow } from "@/lib/env/isomorphic";
import { clearSearchParams } from "@/lib/mindscape/url";
import { useMindscapeStore } from "@/store/mindscape";
import { MindscapeCommandPalette } from "./command-palette";
import { MindscapeDetailPanel } from "./detail-panel";
import { MindscapeInitializer } from "./initializer";
import { WorkflowManager } from "./monitor";
import { NodePanel } from "./node-panel";
import {
  HeaderPanel,
  KnowledgeFilterPanel,
  RagCacheStatsPanel,
} from "./panels";
import { windowTypes as nodeTypes, edgeTypes } from "@/components/windows/registry";
import type { MindscapeSearchParams } from "./spawn";
import { MindscapeWorkflowDrawer } from "./workflow-drawer";

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
    addArtifact,
    focusNode,
    setNodes,
  } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      focusedNodeId: state.focusedNodeId,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      addArtifact: state.addArtifact,
      focusNode: state.focusNode,
      setNodes: state.setNodes,
    }))
  );

  const reactFlow = useReactFlow();

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

  // Edge persistence
  const { onConnectPersisting } = useEdgePersistence();

  // Knowledge filter state
  const [showRuntimeKnowledge, setShowRuntimeKnowledge] = useState(true);
  const [showRagKnowledge, setShowRagKnowledge] = useState(true);

  // Workflow drawer state
  const [inspectedRunId, setInspectedRunId] = useState<string | null>(null);

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

  // Focus and center helper
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

  // RAG cache management
  const ragDocQuery = searchParams?.ragDoc ?? null;
  const {
    ragDocTargetNode,
    ragDocCacheEntryCount,
    ragDocCacheHitRate,
    ragDocCacheStats,
  } = useRagCache({
    ragDocQuery,
    onHydrated: focusAndCenter,
  });

  // Deep link navigation
  const { spawnNodeFromType, handleNavigateToRagDoc } = useDeepLinks({
    searchParams,
    onFocusAndCenter: focusAndCenter,
    onRagDocNavigate,
  });

  // Focus on RAG doc target when available
  useEffect(() => {
    if (!(ragDocQuery && ragDocTargetNode)) {
      return;
    }
    focusAndCenter(ragDocTargetNode.id);
    clearSearchParams(["ragDoc"]);
  }, [ragDocQuery, ragDocTargetNode, focusAndCenter]);

  // Visible nodes/edges (memoized)
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
          <HeaderPanel />
          <KnowledgeFilterPanel
            showRuntimeKnowledge={showRuntimeKnowledge}
            showRagKnowledge={showRagKnowledge}
            onRuntimeKnowledgeChange={setShowRuntimeKnowledge}
            onRagKnowledgeChange={setShowRagKnowledge}
          />
          <RagCacheStatsPanel
            isTraversing={isTraversing}
            hitRate={ragDocCacheHitRate}
            entryCount={ragDocCacheEntryCount}
            stats={ragDocCacheStats}
          />
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
