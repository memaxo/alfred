"use client";

/**
 * Knowledge Graph Canvas - ReactFlow for Knowledge app
 *
 * ⚠️ ISOLATION: @xyflow/react imports ONLY in graphs/
 */

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";

import {
  type KnowledgeEntityData,
  KnowledgeEntityNode,
  type KnowledgeEntityType,
} from "./entity-node";
import { FactEdge, type FactEdgeData } from "./fact-edge";

export type { KnowledgeEntityData, KnowledgeEntityType, FactEdgeData };

// ─────────────────────────────────────────────────────────────────────────────
// NODE & EDGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

const nodeTypes = {
  entity: KnowledgeEntityNode,
};

const edgeTypes = {
  fact: FactEdge,
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const initialNodes: Node<KnowledgeEntityData>[] = [
  {
    id: "1",
    type: "entity",
    position: { x: 0, y: 0 },
    data: { label: "ALFRED", type: "concept", description: "AI Assistant" },
  },
  {
    id: "2",
    type: "entity",
    position: { x: 200, y: 100 },
    data: { label: "TypeScript", type: "concept" },
  },
  {
    id: "3",
    type: "entity",
    position: { x: -200, y: 100 },
    data: { label: "Desktop Shell", type: "concept" },
  },
  {
    id: "4",
    type: "entity",
    position: { x: 0, y: 200 },
    data: { label: "Bun", type: "concept", description: "Runtime" },
  },
];

const initialEdges: Edge<FactEdgeData>[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    type: "fact",
    data: { predicate: "uses", confidence: 0.95 },
  },
  {
    id: "e1-3",
    source: "1",
    target: "3",
    type: "fact",
    data: { predicate: "has component", confidence: 0.92 },
  },
  {
    id: "e1-4",
    source: "1",
    target: "4",
    type: "fact",
    data: { predicate: "runs on", confidence: 0.98 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface KnowledgeGraphCanvasProps {
  onNodeSelect?: (nodeId: string | null) => void;
}

export function KnowledgeGraphCanvas({
  onNodeSelect,
}: KnowledgeGraphCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        colorMode="dark"
        edges={edges}
        edgeTypes={edgeTypes}
        fitView
        nodes={nodes}
        nodeTypes={nodeTypes}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodesChange={onNodesChange}
        onPaneClick={handlePaneClick}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#22d3ee"
          gap={24}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <Controls className="!bg-void-surface !border-white/10" />
      </ReactFlow>
    </div>
  );
}

export { KnowledgeEntityNode } from "./entity-node";
export { FactEdge } from "./fact-edge";
