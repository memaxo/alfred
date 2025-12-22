import type { NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { useLOD, useNodeFocus } from "@/lib/mindscape/lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

export function ArtifactNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  const label = (data?.label as string) || "Artifact";

  // LOD 0: Tiny
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-amber-500" shadow="shadow-amber-500/50" />;
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-amber-500/20"
        hoverColor="hover:border-amber-500/40"
        icon={<Box className="h-3 w-3" />}
        label={label}
        textColor="text-amber-500"
      />
    );
  }

  return (
    <MindscapeNode id={id} selected={selected} title={label}>
      <div className="p-4">
        <CodeBlock code={JSON.stringify(data, null, 2)} language="json" />
      </div>
    </MindscapeNode>
  );
}
