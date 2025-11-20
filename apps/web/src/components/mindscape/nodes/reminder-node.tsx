import type { NodeProps } from "@xyflow/react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reminderNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { MindscapeNode } from "./mindscape-node";

export function ReminderNode({ id, data, selected }: NodeProps) {
  // Validate and parse node data
  const result = reminderNodeDataSchema.safeParse(data);
  const validatedData = result.success
    ? result.data
    : { title: undefined, due: undefined };
  
  const title = validatedData.title ?? "Untitled Reminder";
  const due = validatedData.due ?? new Date().toISOString();
  const reminderId = id.replace("reminder-", "");

  const utils = trpc.useUtils();
  const completeMutation = trpc.remind.fire.useMutation({
    onSuccess: () => {
      toast.success("Reminder completed");
      // Invalidate all remind.list queries
      void utils.remind.list.invalidate();
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
            disabled={completeMutation.isPending}
            onClick={handleComplete}
            size="icon"
            variant="ghost"
          >
            <Check className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </MindscapeNode>
  );
}
