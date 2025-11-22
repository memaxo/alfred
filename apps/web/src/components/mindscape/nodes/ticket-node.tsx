import type { NodeProps } from "@xyflow/react";
import { CheckCircle2, Circle, MoreHorizontal, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ticketNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { MindscapeNode } from "./mindscape-node";
import { useLOD, useNodeFocus } from "../lod";

export function TicketNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  // Validate and parse node data
  const result = ticketNodeDataSchema.safeParse(data);
  const validatedData = result.success
    ? result.data
    : {
        title: undefined,
        status: undefined,
        priority: undefined,
        identifier: undefined,
        issueId: undefined,
      };

  const title = validatedData.title ?? "Untitled Ticket";
  const status = validatedData.status ?? "todo";
  const priority = validatedData.priority ?? "no_priority";
  const identifier = validatedData.identifier ?? "LIN-123";
  const issueId = validatedData.issueId;

  const updateIssue = trpc.linear.updateIssue.useMutation({
    onSuccess: () => {
      toast.success("Ticket updated");
      // In a real app, we'd invalidate queries or update local state
    },
    onError: (err: Error) => {
      toast.error(`Failed to update ticket: ${err.message}`);
    },
  });

  const handlePriorityChange = (newPriority: number) => {
    if (!issueId) {
      return;
    }
    updateIssue.mutate({ issueId, priority: newPriority });
  };

  // Mapping for display only, real update would need state IDs
  // For now, we just demonstrate priority update which uses numbers

  const getStatusIcon = () => {
    switch (status.toLowerCase()) {
      case "done":
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Circle className="h-4 w-4 fill-blue-500/20 text-blue-500" />;
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

  // LOD 0: Tiny
  if (lod === "tiny") {
    return (
      <div className="flex h-3 w-3 items-center justify-center rounded-full bg-indigo-500/40 backdrop-blur-sm">
        <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
      </div>
    );
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-void-surface/40 px-3 py-1 backdrop-blur-md transition-colors hover:border-indigo-500/50">
        <Ticket className="h-3 w-3 text-indigo-400" />
        <span className="max-w-[120px] truncate font-medium text-[10px] text-indigo-300 tracking-tight">
          {identifier}
        </span>
      </div>
    );
  }

  return (
    <MindscapeNode
      className="w-[280px] border-indigo-500/20 bg-indigo-950/10"
      headerActions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-6 w-6" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handlePriorityChange(1)}>
              Set Priority: Urgent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePriorityChange(2)}>
              Set Priority: High
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePriorityChange(3)}>
              Set Priority: Normal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePriorityChange(0)}>
              Set Priority: None
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      id={id}
      selected={selected}
      title={identifier}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="font-medium text-sm leading-tight">{title}</div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            {getStatusIcon()}
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>

          <Badge
            className={`text-[10px] uppercase ${getPriorityColor()}`}
            variant="outline"
          >
            {priority}
          </Badge>
        </div>
      </div>
    </MindscapeNode>
  );
}
