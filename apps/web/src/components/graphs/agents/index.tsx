/**
 * Agent Spawn Tree - ReactFlow tree for agent hierarchy
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

import { AgentNode, type AgentNodeData, type AgentStatus } from "./agent-node";
import { DependencyEdge, type DependencyEdgeData } from "./dependency-edge";

export type { AgentNodeData, AgentStatus, DependencyEdgeData };

// ─────────────────────────────────────────────────────────────────────────────
// NODE & EDGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  dependency: DependencyEdge,
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const initialNodes: Node<AgentNodeData>[] = [
  {
    id: "orchestrator",
    type: "agent",
    position: { x: 200, y: 0 },
    data: {
      label: "Orchestrator",
      role: "coordinator",
      status: "running",
      progress: 0.6,
    },
  },
  {
    id: "planner",
    type: "agent",
    position: { x: 100, y: 100 },
    data: {
      label: "Planner",
      role: "planning",
      status: "completed",
      tokens: 1250,
    },
  },
  {
    id: "coder",
    type: "agent",
    position: { x: 300, y: 100 },
    data: {
      label: "Coder",
      role: "implementation",
      status: "running",
      progress: 0.4,
    },
  },
  {
    id: "reviewer",
    type: "agent",
    position: { x: 200, y: 200 },
    data: { label: "Reviewer", role: "review", status: "waiting" },
  },
];

const initialEdges: Edge<DependencyEdgeData>[] = [
  {
    id: "e1",
    source: "orchestrator",
    target: "planner",
    type: "dependency",
    data: { type: "spawn" },
  },
  {
    id: "e2",
    source: "orchestrator",
    target: "coder",
    type: "dependency",
    data: { type: "spawn" },
  },
  {
    id: "e3",
    source: "planner",
    target: "coder",
    type: "dependency",
    data: { type: "dependency" },
  },
  {
    id: "e4",
    source: "coder",
    target: "reviewer",
    type: "dependency",
    data: { type: "data" },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface SpawnTreeProps {
  onAgentSelect?: (agentId: string | null) => void;
}

export function SpawnTree({ onAgentSelect }: SpawnTreeProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onAgentSelect?.(node.id);
    },
    [onAgentSelect]
  );

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

export { AgentNode } from "./agent-node";
export { DependencyEdge } from "./dependency-edge";
