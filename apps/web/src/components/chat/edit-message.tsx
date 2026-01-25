"use client";

import { Check, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EditMessageProps {
  initialText: string;
  onSave: (newText: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  className?: string;
}

export function EditMessage({
  initialText,
  onSave,
  onCancel,
  disabled = false,
  className,
}: EditMessageProps) {
  const [text, setText] = useState(initialText);

  const handleSave = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      onSave(trimmed);
    }
  }, [text, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border-white/10 bg-white/5 p-3",
        className
      )}
    >
      <Textarea
        autoFocus
        className="min-h-[60px] resize-none bg-transparent text-sm"
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        value={text}
      />
      <div className="flex justify-end gap-2">
        <Button
          className="h-7 px-3 text-xs"
          disabled={disabled}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X className="mr-1 size-3.5" />
          Cancel
        </Button>
        <Button
          className="h-7 px-3 text-xs"
          disabled={disabled || text.trim().length === 0}
          onClick={handleSave}
          size="sm"
          type="button"
        >
          <Check className="mr-1 size-3.5" />
          Save
        </Button>
      </div>
    </div>
  );
}
