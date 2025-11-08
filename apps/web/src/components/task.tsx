/**
 * Task Component
 *
 * Adapted from ai-sdk.dev/elements/components/task
 * Displays task execution progress
 */

import { cn } from "@/lib/utils";

interface TaskProps {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
  className?: string;
}

export function Task({ id, title, status, progress, className }: TaskProps) {
  return (
    <div className={cn("rounded border p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{title}</span>
        <span
          className={cn(
            "rounded px-2 py-1 text-xs",
            status === "completed" && "bg-green-100 text-green-800",
            status === "running" && "bg-blue-100 text-blue-800",
            status === "error" && "bg-red-100 text-red-800",
            status === "pending" && "bg-gray-100 text-gray-800"
          )}
        >
          {status}
        </span>
      </div>
      {progress !== undefined && (
        <div className="mt-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            {progress}% complete
          </p>
        </div>
      )}
    </div>
  );
}
