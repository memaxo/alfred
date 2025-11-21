/**
 * Context Component
 *
 * Adapted from ai-sdk.dev/elements/components/context
 * Displays agent context and runtime state
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CtxProps = {
  runtimeContext?: Record<string, unknown>;
  memory?: {
    resource: string;
    thread: string;
  };
  className?: string;
};

export function Ctx({ runtimeContext, memory, className }: CtxProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {memory && (
          <div>
            <p className="font-medium text-muted-foreground text-sm">Memory</p>
            <p className="text-sm">Resource: {memory.resource}</p>
            <p className="text-sm">Thread: {memory.thread}</p>
          </div>
        )}
        {runtimeContext && Object.keys(runtimeContext).length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground text-sm">Runtime</p>
            <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(runtimeContext, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
