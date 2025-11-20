import type { NodeProps } from "@xyflow/react";
import type { BundledLanguage } from "shiki";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { MindscapeNode } from "./mindscape-node";

export function TerminalNode({ id, data, selected }: NodeProps) {
  const content = (data?.content as string) || "";
  const language = ((data?.language as string) || "bash") as BundledLanguage;

  return (
    <MindscapeNode
      className="w-[600px]"
      id={id}
      selected={selected}
      title={(data?.label as string) || "Terminal"}
    >
      <div className="overflow-hidden rounded-b-md bg-black/80 p-0">
        <CodeBlock
          className="h-[300px] overflow-auto font-mono text-xs"
          code={content}
          language={language}
        />
      </div>
    </MindscapeNode>
  );
}
