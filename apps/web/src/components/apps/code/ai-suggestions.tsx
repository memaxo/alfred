"use client";

/**
 * AI Suggestions - Codex completions overlay
 */

import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AISuggestionsProps = {
  onDismiss: () => void;
  className?: string;
};

export function AISuggestions({ onDismiss, className }: AISuggestionsProps) {
  return (
    <div
      className={cn(
        "absolute top-2 right-2 w-80 rounded-xl border border-biolum/20 bg-void-surface/95 shadow-xl backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between border-white/5 border-b p-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">AI Suggestions</span>
        </div>
        <Button
          className="h-6 w-6"
          onClick={onDismiss}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        <div className="space-y-2">
          <SuggestionItem
            code="export function useKeyboardShortcuts() {"
            description="Add keyboard shortcuts hook"
          />
          <SuggestionItem
            code="const [isLoading, setIsLoading] = useState(false);"
            description="Add loading state"
          />
        </div>
      </div>

      <div className="border-white/5 border-t p-2 text-biolum-dim text-xs">
        Press <kbd className="rounded bg-white/10 px-1">Tab</kbd> to accept
      </div>
    </div>
  );
}

function SuggestionItem({
  code,
  description,
}: {
  code: string;
  description: string;
}) {
  return (
    <button
      className="w-full rounded-lg border border-white/5 bg-white/5 p-2 text-left transition-colors hover:border-biolum/20 hover:bg-white/10"
      type="button"
    >
      <p className="mb-1 text-biolum-dim text-xs">{description}</p>
      <pre className="overflow-x-auto text-biolum text-xs">
        <code>{code}</code>
      </pre>
    </button>
  );
}
