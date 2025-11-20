import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Orb } from "@/components/ui/orb";
import { memo } from "react";

export const OrbNode = memo(({ selected }: NodeProps) => {
  return (
    <div className="relative flex h-[400px] w-[400px] items-center justify-center rounded-full">
      <div className="absolute inset-0">
        <Orb 
           className="h-full w-full"
           colors={["#FFFFFF", "#A855F7"]} // White/Purple flare
           agentState="listening" // Default state for now
        />
      </div>
      
      {/* Handles for connections */}
      <Handle
        type="source"
        position={Position.Top}
        className="!bg-transparent !border-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-transparent !border-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-none"
      />
      <Handle
        type="source"
        position={Position.Left}
        className="!bg-transparent !border-none"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-none"
      />
    </div>
  );
});

OrbNode.displayName = "OrbNode";

