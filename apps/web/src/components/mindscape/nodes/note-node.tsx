import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NodeProps } from "@xyflow/react";
import { FileText } from "lucide-react";
import { MindscapeNode } from "./mindscape-node";

export function NoteNode({ id, data, selected }: NodeProps) {
  const title = (data?.title as string) || "Untitled Note";
  const content = (data?.content as string) || "";
  const tags = (data?.tags as string[]) || [];

  return (
    <MindscapeNode
      className="w-[300px] border-yellow-500/20 bg-yellow-950/10"
      headerActions={<FileText className="h-4 w-4 text-yellow-500" />}
      id={id}
      selected={selected}
      title={title}
    >
      <div className="flex flex-col gap-2 p-4">
        <ScrollArea className="h-[150px]">
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {content || <span className="italic opacity-50">No content</span>}
          </div>
        </ScrollArea>
        
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {tags.map((tag) => (
              <Badge
                className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                key={tag}
                variant="secondary"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </MindscapeNode>
  );
}
