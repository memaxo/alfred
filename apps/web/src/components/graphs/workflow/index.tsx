/**
 * Workflow DAG Canvas - ReactFlow for Workflow Builder
 *
 * ⚠️ ISOLATION: @xyflow/react imports ONLY in graphs/
 */

import {
  Background,
  BackgroundVariant,
  type Connection,
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
  ActionNode,
  type WorkflowNodeData,
  type WorkflowNodeType,
} from "./action-node";
import { ConditionNode } from "./condition-node";
import { FlowEdge, type FlowEdgeData } from "./flow-edge";

export type { WorkflowNodeData, WorkflowNodeType, FlowEdgeData };

// ─────────────────────────────────────────────────────────────────────────────
// NODE & EDGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

const nodeTypes = {
  action: ActionNode,
  condition: ConditionNode,
};

const edgeTypes = {
  flow: FlowEdge,
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const initialNodes: Node<WorkflowNodeData>[] = [
  {
    id: "trigger",
    type: "action",
    position: { x: 200, y: 0 },
    data: {
      label: "On Schedule",
      type: "trigger",
      description: "Every 5 minutes",
    },
  },
  {
    id: "fetch",
    type: "action",
    position: { x: 200, y: 100 },
    data: { label: "Fetch Data", type: "action", description: "HTTP GET" },
  },
  {
    id: "check",
    type: "condition",
    position: { x: 200, y: 200 },
    data: { label: "Has Updates?", type: "condition" },
  },
  {
    id: "notify",
    type: "action",
    position: { x: 100, y: 300 },
    data: { label: "Send Notification", type: "action" },
  },
  {
    id: "log",
    type: "action",
    position: { x: 300, y: 300 },
    data: { label: "Log Result", type: "output" },
  },
];

const initialEdges: Edge<FlowEdgeData>[] = [
  { id: "e1", source: "trigger", target: "fetch", type: "flow" },
  { id: "e2", source: "fetch", target: "check", type: "flow" },
  {
    id: "e3",
    source: "check",
    target: "notify",
    type: "flow",
    data: { label: "Yes" },
  },
  {
    id: "e4",
    source: "check",
    target: "log",
    type: "flow",
    data: { label: "No" },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  onNodeSelect?: (nodeId: string | null) => void;
}

export function WorkflowCanvas({ onNodeSelect }: WorkflowCanvasProps) {
  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge<FlowEdgeData> = {
        ...connection,
        id: `e-${connection.source}-${connection.target}`,
        type: "flow",
      };
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        colorMode="dark"
        defaultEdgeOptions={{ type: "flow" }}
        edges={edges}
        edgeTypes={edgeTypes}
        fitView
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#22d3ee"
          gap={20}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <Controls className="!bg-void-surface !border-white/10" />
      </ReactFlow>
    </div>
  );
}

export { ActionNode } from "./action-node";
export { ConditionNode } from "./condition-node";
export { FlowEdge } from "./flow-edge";
