/**
 * Actions Component
 * 
 * Adapted from ai-sdk.dev/elements/components/actions
 * Displays agent actions and tool calls
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Action {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "error";
  result?: unknown;
}

interface ActionsProps {
  actions: Action[];
  className?: string;
}

export function Actions({ actions, className }: ActionsProps) {
  if (actions.length === 0) return null;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <div
            key={action.id}
            className="rounded border p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{action.name}</span>
              <span
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  action.status === "completed" && "bg-green-100 text-green-800",
                  action.status === "running" && "bg-blue-100 text-blue-800",
                  action.status === "error" && "bg-red-100 text-red-800",
                  action.status === "pending" && "bg-gray-100 text-gray-800",
                )}
              >
                {action.status}
              </span>
            </div>
            {action.args && (
              <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(action.args, null, 2)}
              </pre>
            )}
            {action.result && (
              <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(action.result, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

