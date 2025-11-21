import type { NodeProps } from "@xyflow/react";
import { CheckCircle2, Circle, MoreHorizontal } from "lucide-react";
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

export function TicketNode({ id, data, selected }: NodeProps) {
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
