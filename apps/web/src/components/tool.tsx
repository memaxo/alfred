/**
 * Tool Component
 *
 * Adapted from ai-sdk.dev/elements/components/tool
 * Displays tool invocation details
 */

import { cn } from "@/lib/utils";

interface ToolProps {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "error";
  className?: string;
}

export function Tool({ name, args, result, status, className }: ToolProps) {
  return (
    <div className={cn("rounded border p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{name}</span>
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
      {args && (
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(args, null, 2)}
        </pre>
      )}
      {result && (
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
