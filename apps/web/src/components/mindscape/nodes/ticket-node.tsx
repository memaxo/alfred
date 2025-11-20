import { Badge } from "@/components/ui/badge";
import type { NodeProps } from "@xyflow/react";
import { CheckCircle2, Circle, GitPullRequest } from "lucide-react";
import { MindscapeNode } from "./mindscape-node";

export function TicketNode({ id, data, selected }: NodeProps) {
  const title = (data?.title as string) || "Untitled Ticket";
  const status = (data?.status as string) || "todo";
  const priority = (data?.priority as string) || "no_priority";
  const identifier = (data?.identifier as string) || "LIN-123";

  const getStatusIcon = () => {
    switch (status.toLowerCase()) {
      case "done":
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Circle className="h-4 w-4 text-blue-500 fill-blue-500/20" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = () => {
    switch (priority.toLowerCase()) {
      case "urgent":
        return "text-red-500 border-red-500/20 bg-red-500/10";
      case "high":
        return "text-orange-500 border-orange-500/20 bg-orange-500/10";
      default:
        return "text-muted-foreground border-white/10 bg-white/5";
    }
  };

  return (
    <MindscapeNode
      className="w-[280px] border-indigo-500/20 bg-indigo-950/10"
      headerActions={<GitPullRequest className="h-4 w-4 text-indigo-500" />}
      id={id}
      selected={selected}
      title={identifier}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="text-sm font-medium leading-tight">{title}</div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {getStatusIcon()}
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
          
          <Badge variant="outline" className={`text-[10px] uppercase ${getPriorityColor()}`}>
            {priority}
          </Badge>
        </div>
      </div>
    </MindscapeNode>
  );
}
