/**
 * Node Component
 * 
 * Adapted from ai-sdk.dev/elements/components/node
 * Displays workflow node in canvas
 */

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NodeProps {
  id: string;
  label: string;
  type: "task" | "decision" | "action";
  status: "pending" | "running" | "completed" | "error";
  className?: string;
}

export function Node({ id, label, type, status, className }: NodeProps) {
  return (
    <Card
      className={cn(
        "w-48 cursor-pointer transition-all hover:shadow-md",
        status === "completed" && "border-green-500",
        status === "running" && "border-blue-500",
        status === "error" && "border-red-500",
        className,
      )}
    >
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {type}
            </span>
            <span
              className={cn(
                "size-2 rounded-full",
                status === "completed" && "bg-green-500",
                status === "running" && "bg-blue-500 animate-pulse",
                status === "error" && "bg-red-500",
                status === "pending" && "bg-gray-500",
              )}
            />
          </div>
          <p className="text-sm font-medium">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

