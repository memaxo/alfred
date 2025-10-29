/**
 * Plan Component
 * 
 * Adapted from ai-sdk.dev/elements/components/plan
 * Displays orchestration plan and task breakdown
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
  subtasks?: Task[];
}

interface PlanProps {
  plan: {
    requirement: string;
    tasks: Task[];
  };
  className?: string;
}

export function Plan({ plan, className }: PlanProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Requirement
          </p>
          <p className="text-sm">{plan.requirement}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Tasks
          </p>
          <div className="mt-2 space-y-2">
            {plan.tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskItem({ task }: { task: Task }) {
  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{task.title}</span>
        <span
          className={cn(
            "rounded px-2 py-1 text-xs",
            task.status === "completed" && "bg-green-100 text-green-800",
            task.status === "running" && "bg-blue-100 text-blue-800",
            task.status === "error" && "bg-red-100 text-red-800",
            task.status === "pending" && "bg-gray-100 text-gray-800",
          )}
        >
          {task.status}
        </span>
      </div>
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {task.subtasks.map((subtask) => (
            <TaskItem key={subtask.id} task={subtask} />
          ))}
        </div>
      )}
    </div>
  );
}

