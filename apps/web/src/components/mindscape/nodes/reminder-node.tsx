import { Button } from "@/components/ui/button";
import type { NodeProps } from "@xyflow/react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check } from "lucide-react";
import { MindscapeNode } from "./mindscape-node";
import { trpc } from "@/utils/trpc";
import { toast } from "sonner";

export function ReminderNode({ id, data, selected }: NodeProps) {
  const title = (data?.title as string) || "Untitled Reminder";
  const due = (data?.due as string) || new Date().toISOString();
  const reminderId = id.replace("reminder-", "");

  // @ts-ignore - trpc type inference issue
  const utils = trpc.useUtils();
  // @ts-ignore - trpc type inference issue
  const completeMutation = trpc.remind.fire.useMutation({
    onSuccess: () => {
      toast.success("Reminder completed");
      // @ts-ignore
      utils.remind.list.invalidate();
      // We should also remove the node from the store, but the initializer sync might handle it
      // or we can let the user close it.
    },
  });

  const handleComplete = () => {
    completeMutation.mutate({ id: reminderId });
  };

  return (
    <MindscapeNode
      className="w-[250px] border-blue-500/20 bg-blue-950/10"
      headerActions={<Bell className="h-4 w-4 text-blue-500" />}
      id={id}
      selected={selected}
      title="Reminder"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="font-medium text-sm">{title}</div>
        
        <div className="flex items-center justify-between">
          <div className="text-blue-400 text-xs">
            Due {formatDistanceToNow(new Date(due), { addSuffix: true })}
          </div>
          
          <Button
            className="h-6 w-6 rounded-full p-0 hover:bg-blue-500/20 hover:text-blue-400"
            onClick={handleComplete}
            variant="ghost"
            size="icon"
            disabled={completeMutation.isPending}
          >
            <Check className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </MindscapeNode>
  );
}
