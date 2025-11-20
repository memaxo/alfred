import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { Orb } from "@/components/ui/orb";

export const OrbNode = memo(({ selected }: NodeProps) => {
  return (
    <div className="relative flex h-[400px] w-[400px] items-center justify-center rounded-full">
      <div className="absolute inset-0">
        <Orb
          agentState="listening"
          className="h-full w-full" // White/Purple flare
          colors={["#FFFFFF", "#A855F7"]} // Default state for now
        />
      </div>

      {/* Handles for connections */}
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Top}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Right}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Bottom}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Left}
        type="source"
      />
      <Handle
        className="!bg-transparent !border-none"
        position={Position.Top}
        type="target"
      />
    </div>
  );
});

OrbNode.displayName = "OrbNode";
