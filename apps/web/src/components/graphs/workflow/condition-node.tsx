"use client";

/**
 * Condition Node - Workflow condition/decision node
 */

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { GitFork } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "./action-node";

type ConditionNodeProps = NodeProps<Node<WorkflowNodeData>>;

export function ConditionNode({ data, selected }: ConditionNodeProps) {
  const nodeData = data as WorkflowNodeData;
  return (
    <>
      <Handle className="!bg-biolum" position={Position.Top} type="target" />

      <div
        className={cn(
          "min-w-28 rotate-45 rounded-lg border-2 border-purple-500/50 bg-purple-500/10 p-4 shadow-lg transition-all",
          selected && "ring-2 ring-biolum ring-offset-2 ring-offset-void"
        )}
      >
        <div className="-rotate-45 flex flex-col items-center justify-center">
          <GitFork className="h-4 w-4 text-purple-400" />
          <span className="mt-1 text-center font-medium text-sm">
            {nodeData.label}
          </span>
        </div>
      </div>

      <Handle
        className="!bg-green-400"
        id="yes"
        position={Position.Left}
        style={{ top: "50%", left: "-8px" }}
        type="source"
      />
      <Handle
        className="!bg-red-400"
        id="no"
        position={Position.Right}
        style={{ top: "50%", right: "-8px" }}
        type="source"
      />
    </>
  );
}
