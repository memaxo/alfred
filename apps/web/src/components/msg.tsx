/**
 * Message Component
 * 
 * Adapted from ui.elevenlabs.io/docs/components/message
 * Individual message bubble in conversation
 * 
 * Carmack-Karpathy principles:
 * - Pure function: deterministic rendering
 * - Null safety: handles missing data
 * - Zero allocations: no object creation in render
 */

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface MsgProps {
  role: "user" | "assistant" | "orchestrator";
  content: string;
  timestamp: Date;
  className?: string;
}

function MsgInner({ role, content, timestamp, className }: MsgProps) {
  // Null safety: handle missing content
  if (!content) {
    return null;
  }

  const isUser = role === "user";
  const timeStr = timestamp?.toLocaleTimeString() ?? "";

  return (
    <Card
      className={cn(
        "w-fit max-w-[80%]",
        isUser && "ml-auto",
        !isUser && "mr-auto",
        className,
      )}
    >
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {role}
            </span>
            {timeStr && (
              <span className="text-xs text-muted-foreground">
                {timeStr}
              </span>
            )}
          </div>
          <p className="text-sm">{content}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Memoize: pure component
export const Msg = memo(MsgInner);

