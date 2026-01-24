"use client";

/**
 * Mindscape Canvas - ReactFlow infinite canvas for knowledge exploration
 *
 * ⚠️ ISOLATION: All @xyflow/react imports ONLY allowed here
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 1.5
 */

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useState } from "react";

import { useMindscapeStore } from "@/store/mindscape";

import { EntityNode } from "./entity-node";
import { RelationEdge } from "./relation-edge";

// ─────────────────────────────────────────────────────────────────────────────
// NODE & EDGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

const nodeTypes = {
  entity: EntityNode,
};

const edgeTypes = {
  relation: RelationEdge,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function MindscapeCanvas() {
  const nodes = useMindscapeStore((s) => s.nodes);
  const edges = useMindscapeStore((s) => s.edges);
  const onNodesChange = useMindscapeStore((s) => s.onNodesChange);
  const onEdgesChange = useMindscapeStore((s) => s.onEdgesChange);
  const onConnect = useMindscapeStore((s) => s.onConnect);
  const setViewport = useMindscapeStore((s) => s.setViewport);

  const [_rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    setRfInstance(instance);
    instance.fitView({ padding: 0.2 });
  }, []);

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(viewport);
    },
    [setViewport]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        colorMode="dark"
        defaultEdgeOptions={{
          type: "relation",
          animated: true,
        }}
        edges={edges}
        edgeTypes={edgeTypes}
        fitView
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onInit={handleInit}
        onMoveEnd={handleMoveEnd}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#22d3ee"
          gap={32}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <Controls className="!bg-void-surface !border-white/10" />
        <MiniMap
          className="!bg-void-surface !border-white/10"
          maskColor="rgba(0, 0, 0, 0.8)"
          nodeColor={(node) => {
            switch (node.data?.type) {
              case "concept":
                return "#22d3ee";
              case "entity":
                return "#a78bfa";
              case "window":
                return "#fbbf24";
              default:
                return "#64748b";
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}

export { EntityNode } from "./entity-node";
export { MindscapeLayer } from "./layer";
export { RelationEdge } from "./relation-edge";
