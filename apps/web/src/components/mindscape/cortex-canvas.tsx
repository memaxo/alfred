/**
 * Cortex-Enhanced Mindscape Canvas
 *
 * Layers the WebGPU Cortex renderer beneath a transparent xyflow overlay.
 * Cortex handles all visual rendering (particles, corona, edges, nodes, atmosphere).
 * xyflow handles interaction (positioning, dragging, selection, pan/zoom).
 */

"use client";

import {
  Controls,
  MiniMap,
  type NodeProps,
  type NodeTypes,
  Panel,
  ReactFlow,
  type ReactFlowProps,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useCortexEngine, useWebGPUSupport } from "@/hooks/use-cortex-engine";
import {
  useCortexBridge,
  useCortexLOD,
  useCortexOrbState,
} from "@/lib/cortex-bridge";
import { useMindscapeStore } from "@/store/mindscape";
import { MindscapeCommandPalette } from "./command-palette";
import { MindscapeDetailPanel } from "./detail-panel";
import { MindscapeInitializer } from "./initializer";
import { WorkflowManager } from "./monitor";
import { NodePanel } from "./node-panel";
import { NodeErrorBoundary } from "./nodes/error-boundary";
import {
  createSpawnNode,
  formatSpawnLabel,
  type MindscapeSearchParams,
  type MindscapeSpawnType,
  singletonSpawnTypes,
} from "./spawn";

// Transparent node components - only render hit areas, no visuals
// Cortex handles all visual rendering
const TransparentNode = ({ id }: NodeProps) => (
  <div
    className="pointer-events-auto cursor-pointer"
    data-node-id={id}
    style={{
      width: "100%",
      height: "100%",
      background: "transparent",
      border: "none",
    }}
  />
);

const wrapWithErrorBoundary =
  (Component: React.ComponentType<NodeProps>) => (props: NodeProps) => (
    <NodeErrorBoundary nodeId={props.id}>
      <Component {...props} />
    </NodeErrorBoundary>
  );

// All node types use transparent hit areas - Cortex renders visuals
const transparentNodeTypes: NodeTypes = {
  orb: wrapWithErrorBoundary(TransparentNode),
  artifact: wrapWithErrorBoundary(TransparentNode),
  chat: wrapWithErrorBoundary(TransparentNode),
  workflow: wrapWithErrorBoundary(TransparentNode),
  terminal: wrapWithErrorBoundary(TransparentNode),
  droid: wrapWithErrorBoundary(TransparentNode),
  note: wrapWithErrorBoundary(TransparentNode),
  reminder: wrapWithErrorBoundary(TransparentNode),
  ticket: wrapWithErrorBoundary(TransparentNode),
  code: wrapWithErrorBoundary(TransparentNode),
  timer: wrapWithErrorBoundary(TransparentNode),
  bookmark: wrapWithErrorBoundary(TransparentNode),
  todo: wrapWithErrorBoundary(TransparentNode),
  settings: wrapWithErrorBoundary(TransparentNode),
  privacy: wrapWithErrorBoundary(TransparentNode),
  profile: wrapWithErrorBoundary(TransparentNode),
  integrations: wrapWithErrorBoundary(TransparentNode),
  workflowlist: wrapWithErrorBoundary(TransparentNode),
  deployment: wrapWithErrorBoundary(TransparentNode),
  knowledge: wrapWithErrorBoundary(TransparentNode),
  concept: wrapWithErrorBoundary(TransparentNode),
};

type CortexMindscapeCanvasProps = Omit<
  ReactFlowProps,
  "nodes" | "edges" | "onNodesChange" | "onEdgesChange" | "onConnect"
> & {
  searchParams?: MindscapeSearchParams;
  onWorkflowNavigate?: (runId: string) => void;
  onRagDocNavigate?: (documentId: string) => void;
  /** Agent state for orb visualization */
  agentState?: "idle" | "listening" | "thinking" | "speaking";
  /** Audio levels for visualization */
  audioLevels?: { low: number; mid: number };
};

export function CortexMindscapeCanvas(props: CortexMindscapeCanvasProps) {
  return (
    <ReactFlowProvider>
      <CortexMindscapeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CortexMindscapeCanvasInner({
  searchParams,
  onWorkflowNavigate,
  onRagDocNavigate,
  agentState = "idle",
  audioLevels = { low: 0, mid: 0 },
  ...props
}: CortexMindscapeCanvasProps) {
  const webGPUSupported = useWebGPUSupport();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    nodes,
    focusedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addArtifact,
    focusNode,
  } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      focusedNodeId: state.focusedNodeId,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      addArtifact: state.addArtifact,
      focusNode: state.focusNode,
    }))
  );

  // Initialize Cortex engine
  const { engine, isReady, error, capability } = useCortexEngine(canvasRef, {
    postProcessing: true,
    onReady: () => {},
    onError: (_err) => {},
  });

  // Bridge xyflow state to Cortex GPU buffers
  useCortexBridge(engine);

  // Handle orb state and audio
  useCortexOrbState(engine, agentState, audioLevels);

  // Handle LOD based on zoom
  const viewport = useViewport();
  useCortexLOD(engine, viewport.zoom);

  const reactFlow = useReactFlow();

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
          // Ignore fitView errors
        }
      });
    },
    [focusNode, reactFlow]
  );

  const spawnNodeFromType = useCallback(
    (spawnType: MindscapeSpawnType): string | null => {
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

  // Show fallback warning if WebGPU not supported
  useEffect(() => {
    if (capability && capability !== "webgpu") {
      toast.info(`WebGPU not available. Using ${capability} rendering.`);
    }
  }, [capability]);

  return (
    <>
      <div className="relative h-screen w-full overflow-hidden bg-[oklch(0.05_0_0)]">
        {/* Cortex WebGPU Canvas - renders ALL visuals */}
        <canvas
          className="absolute inset-0 z-0"
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: webGPUSupported ? "block" : "none",
          }}
        />

        {/* Loading/Error states */}
        {!isReady && webGPUSupported && (
          <div className="absolute inset-0 z-5 flex items-center justify-center">
            <div className="animate-pulse text-biolum-dim text-sm">
              Initializing Cortex Engine...
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-5 flex items-center justify-center">
            <div className="text-red-400 text-sm">
              Cortex Error: {error.message}
            </div>
          </div>
        )}

        {/* xyflow - transparent overlay for interaction only */}
        <ReactFlow
          className="absolute inset-0 z-10"
          colorMode="dark"
          defaultViewport={{ x: 0, y: 0, zoom: 1 }} // Edges rendered by Cortex
          edges={[]}
          fitView
          fitViewOptions={{
            minZoom: 0.8,
            maxZoom: 1.5,
            padding: 0.3,
          }}
          maxZoom={4}
          minZoom={0.1}
          nodes={nodes}
          nodeTypes={transparentNodeTypes}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          panOnDrag={true}
          panOnScroll={false}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag={true}
          style={{ background: "transparent" }}
          {...props}
          onNodeClick={(_, node) => {
            focusAndCenter(node.id);
          }}
        >
          {/* No Background - Cortex handles atmosphere */}

          {/* Minimal UI controls */}
          <Controls className="border-white/10 bg-void-surface/80 text-biolum backdrop-blur-sm" />
          <MiniMap
            className="border-white/10 bg-void-surface/60 backdrop-blur-sm"
            maskColor="rgba(0, 0, 0, 0.6)"
            nodeColor={(node) => {
              if (node.id === focusedNodeId) {
                return "#00E5CC";
              }
              return "#666";
            }}
          />

          {/* Status Panel */}
          <Panel
            className="rounded-full border border-white/10 bg-void-surface/60 px-4 py-2 text-[10px] text-biolum-dim uppercase tracking-widest backdrop-blur-sm"
            position="top-center"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isReady ? "bg-emerald-400" : "animate-pulse bg-amber-400"
                }`}
              />
              <span>
                Cortex {capability?.toUpperCase() ?? "..."}{" "}
                {isReady ? "Active" : "Loading"}
              </span>
            </div>
          </Panel>

          <MindscapeInitializer />
          <WorkflowManager />
        </ReactFlow>

        <MindscapeDetailPanel onWorkflowNavigate={onWorkflowNavigate} />
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

/**
 * Feature flag to choose between Cortex and legacy rendering
 */
export function useCortexEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Check feature flag or environment
    const flag =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).__CORTEX_ENABLED__ ===
            true || import.meta.env?.VITE_CORTEX_ENABLED === "true"
        : false;
    setEnabled(flag);
  }, []);

  return enabled;
}
