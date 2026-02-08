import { Pencil, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MessageActionsProps<M = unknown> {
  role: "user" | "assistant" | "system" | "data";
  message: M;
  onEdit?: (message: M) => void;
  onRegenerate?: (message: M) => void;
  onPositive?: (message: M) => void;
  onNegative?: (message: M) => void;
  disabled?: boolean;
  className?: string;
}

export function MessageActions<M>({
  role,
  message,
  onEdit,
  onRegenerate,
  onPositive,
  onNegative,
  disabled,
  className,
}: MessageActionsProps<M>) {
  const handleEdit = useCallback(() => {
    onEdit?.(message);
  }, [onEdit, message]);

  const handleRegenerate = useCallback(() => {
    onRegenerate?.(message);
  }, [onRegenerate, message]);

  const handlePositive = useCallback(() => {
    onPositive?.(message);
  }, [onPositive, message]);

  const handleNegative = useCallback(() => {
    onNegative?.(message);
  }, [onNegative, message]);

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
          onClick={handleEdit}
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
              onClick={handleRegenerate}
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
              onClick={handlePositive}
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
              onClick={handleNegative}
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
