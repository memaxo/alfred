/**
 * Queue Component
 *
 * Adapted from ai-sdk.dev/elements/components/queue
 * Displays task queue status
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
}

interface QueueProps {
  items: QueueItem[];
  className?: string;
}

export function Queue({ items, className }: QueueProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Queue ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No items in queue</p>
        ) : (
          items.map((item) => (
            <div
              className="flex items-center justify-between rounded border p-2"
              key={item.id}
            >
              <span className="text-sm">{item.title}</span>
              <span
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  item.priority === "high" && "bg-red-100 text-red-800",
                  item.priority === "medium" && "bg-yellow-100 text-yellow-800",
                  item.priority === "low" && "bg-green-100 text-green-800"
                )}
              >
                {item.priority}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
