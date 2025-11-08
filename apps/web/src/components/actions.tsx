/**
 * Actions Component
 *
 * Adapted from ai-sdk.dev/elements/components/actions
 * Displays agent actions and tool calls
 */

import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssistantAction } from "@/hooks/use-assistant-stream";
import { cn } from "@/lib/utils";

type ActionsProps = {
  actions: AssistantAction[];
  className?: string;
};

function StatusIcon({ status }: { status: AssistantAction["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (status === "running" || status === "pending") {
    return <Loader2 className="h-4 w-4 animate-spin text-sky-500" />;
  }
  if (status === "error") {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function ActionItem({ action }: { action: AssistantAction }) {
  const [expanded, setExpanded] = useState(false);
  const hasArgs = action.args && Object.keys(action.args).length > 0;
  const hasResult = action.result !== undefined && action.result !== null;
  const hasError = typeof action.error === "string" && action.error.length > 0;

  return (
    <div className="rounded border">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        onClick={() => setExpanded((prev) => !prev)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={action.status} />
          <span className="font-medium capitalize">{action.name}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      {expanded && (
        <div className="space-y-3 border-t px-3 py-3 text-sm">
          <div className="text-muted-foreground text-xs">
            Status: {action.status}
          </div>
          {hasArgs && (
            <div>
              <p className="font-medium text-muted-foreground text-xs uppercase">
                Input
              </p>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(action.args, null, 2)}
              </pre>
            </div>
          )}
          {hasResult && (
            <div>
              <p className="font-medium text-muted-foreground text-xs uppercase">
                Output
              </p>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(action.result, null, 2)}
              </pre>
            </div>
          )}
          {hasError && <p className="text-red-500 text-xs">{action.error}</p>}
        </div>
      )}
    </div>
  );
}

export function Actions({ actions, className }: ActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Tool Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <ActionItem action={action} key={action.id} />
        ))}
      </CardContent>
    </Card>
  );
}
