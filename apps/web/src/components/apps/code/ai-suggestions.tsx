"use client";

/**
 * AI Suggestions - Codex completions overlay
 */

import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type AISuggestionsProps = {
  onDismiss: () => void;
  onAccept: (code: string) => void;
  path: string;
  currentCode: string;
  cursorLine: number;
  cursorColumn: number;
  language: string;
  className?: string;
};

type Suggestion = {
  id: string;
  code: string;
  description: string;
};

export function AISuggestions({
  onDismiss,
  onAccept,
  path,
  currentCode,
  cursorLine,
  cursorColumn,
  language,
  className,
}: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data, isLoading, refetch } = trpc.codex.suggest.useQuery(
    {
      path,
      content: currentCode,
      line: cursorLine,
      column: cursorColumn,
      language,
    },
    {
      enabled: false,
    }
  );

  useEffect(() => {
    if (data?.suggestion) {
      setSuggestions([
        {
          id: crypto.randomUUID(),
          code: data.suggestion,
          description: "Codex Completion",
        },
      ]);
    }
  }, [data]);

  const generateSuggestions = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab" && suggestions[selectedIndex]) {
        e.preventDefault();
        onAccept(suggestions[selectedIndex].code);
        onDismiss();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    },
    [suggestions, selectedIndex, onAccept, onDismiss]
  );

  return (
    <div
      className={cn(
        "absolute top-2 right-2 w-80 rounded-xl border border-biolum/20 bg-void-surface/95 shadow-xl backdrop-blur-xl",
        className
      )}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between border-white/5 border-b p-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">AI Suggestions</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            className="h-6 w-6"
            disabled={isLoading}
            onClick={generateSuggestions}
            size="icon"
            variant="ghost"
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          </Button>
          <Button
            className="h-6 w-6"
            onClick={onDismiss}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-biolum-dim" />
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                code={suggestion.code}
                description={suggestion.description}
                isSelected={index === selectedIndex}
                key={suggestion.id}
                onAccept={() => {
                  onAccept(suggestion.code);
                  onDismiss();
                }}
                onHover={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-white/5 border-t p-2 text-biolum-dim text-xs">
        <kbd className="rounded bg-white/10 px-1">Tab</kbd> Accept{" "}
        <kbd className="ml-2 rounded bg-white/10 px-1">↑↓</kbd> Navigate{" "}
        <kbd className="ml-2 rounded bg-white/10 px-1">Esc</kbd> Dismiss
      </div>
    </div>
  );
}

function SuggestionItem({
  code,
  description,
  isSelected,
  onAccept,
  onHover,
}: {
  code: string;
  description: string;
  isSelected: boolean;
  onAccept: () => void;
  onHover: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-lg border p-2 text-left transition-colors",
        isSelected
          ? "border-biolum/40 bg-biolum/10"
          : "border-white/5 bg-white/5 hover:border-biolum/20 hover:bg-white/10"
      )}
      onClick={onAccept}
      onMouseEnter={onHover}
      type="button"
    >
      <p className="mb-1 text-biolum-dim text-xs">{description}</p>
      <pre className="overflow-x-auto text-biolum text-xs">
        <code>{code}</code>
      </pre>
    </button>
  );
}
