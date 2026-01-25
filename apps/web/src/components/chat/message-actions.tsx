import { Pencil, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MessageActionsProps {
  role: "user" | "assistant" | "system" | "data";
  onEdit?: () => void;
  onRegenerate?: () => void;
  onPositive?: () => void;
  onNegative?: () => void;
  disabled?: boolean;
  className?: string;
}

export function MessageActions({
  role,
  onEdit,
  onRegenerate,
  onPositive,
  onNegative,
  disabled,
  className,
}: MessageActionsProps) {
  if (role === "system" || role === "data") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-muted-foreground transition-opacity group-hover:opacity-100 sm:opacity-0",
        className
      )}
    >
      {role === "user" && onEdit && (
        <Button
          className="h-7 w-7 rounded-full hover:bg-white/10"
          disabled={disabled}
          onClick={onEdit}
          size="icon"
          title="Edit message"
          type="button"
          variant="ghost"
        >
          <Pencil className="size-3.5" />
        </Button>
      )}

      {role === "assistant" && (
        <>
          {onRegenerate && (
            <Button
              className="h-7 w-7 rounded-full hover:bg-white/10"
              disabled={disabled}
              onClick={onRegenerate}
              size="icon"
              title="Regenerate response"
              type="button"
              variant="ghost"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
          {onPositive && (
            <Button
              className="h-7 w-7 rounded-full hover:bg-white/10"
              disabled={disabled}
              onClick={onPositive}
              size="icon"
              title="Helpful"
              type="button"
              variant="ghost"
            >
              <ThumbsUp className="size-3.5" />
            </Button>
          )}
          {onNegative && (
            <Button
              className="h-7 w-7 rounded-full hover:bg-white/10"
              disabled={disabled}
              onClick={onNegative}
              size="icon"
              title="Not helpful"
              type="button"
              variant="ghost"
            >
              <ThumbsDown className="size-3.5" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
