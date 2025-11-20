import type { NodeProps } from "@xyflow/react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { MindscapeNode } from "./mindscape-node";

export function ArtifactNode({ id, data, selected }: NodeProps) {
  return (
    <MindscapeNode
      id={id}
      selected={selected}
      title={(data?.label as string) || "Artifact"}
    >
      <div className="p-4">
        <CodeBlock code={JSON.stringify(data, null, 2)} language="json" />
      </div>
    </MindscapeNode>
  );
}
