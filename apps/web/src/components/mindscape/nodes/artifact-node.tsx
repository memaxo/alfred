import type { NodeProps } from "@xyflow/react";
import { MindscapeNode } from "./mindscape-node";

export function ArtifactNode({ id, data, selected }: NodeProps) {
  return (
    <MindscapeNode
      id={id}
      selected={selected}
      title={(data?.label as string) || "Artifact"}
    >
      <div className="p-4 text-biolum-dim text-sm">
        {/* Content goes here - generic render */}
        {JSON.stringify(data, null, 2)}
      </div>
    </MindscapeNode>
  );
}
