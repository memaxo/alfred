"use client";

/**
 * Semantic Search - AI-powered code search using embeddings
 *
 * Search code by meaning, not just text matching.
 *
 * @see @alfred/embed package
 */

import {
  ChevronRight,
  FileCode,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SemanticSearchProps = {
  className?: string;
  onResultSelect?: (file: string, line: number) => void;
};

type SearchResult = {
  id: string;
  file: string;
  line: number;
  content: string;
  score: number;
  context: string;
};

const mockResults: SearchResult[] = [
  {
    id: "1",
    file: "packages/api/src/routers/chat.ts",
    line: 45,
    content: "export const chatRouter = router({",
    score: 0.94,
    context: "Main chat router definition with all procedures",
  },
  {
    id: "2",
    file: "packages/agent/src/runner.ts",
    line: 120,
    content: "async function executeAgentLoop(ctx: AgentContext)",
    score: 0.89,
    context: "Agent execution loop that processes tasks",
  },
  {
    id: "3",
    file: "packages/cognitive/src/transition.ts",
    line: 78,
    content: "function applyTransition(state: CognitiveState)",
    score: 0.85,
    context: "State machine transition handler",
  },
  {
    id: "4",
    file: "apps/web/src/components/chat/message-list.tsx",
    line: 34,
    content: "export function MessageList({ messages }: MessageListProps)",
    score: 0.82,
    context: "Chat message list component",
  },
];

export function SemanticSearch({
  className,
  onResultSelect,
}: SemanticSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    // Mock search delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    setResults(mockResults);
    setLoading(false);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Search Input */}
      <div className="border-white/5 border-b p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Semantic Search</span>
        </div>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pr-3 pl-8 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Describe what you're looking for..."
              value={query}
            />
          </div>
          <Button disabled={loading} onClick={handleSearch}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        <p className="mt-2 text-biolum-dim text-xs">
          Search by meaning: "function that handles user authentication" or
          "where errors are logged"
        </p>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {results ? (
          <div className="space-y-2 p-3">
            <div className="text-biolum-dim text-xs">
              {results.length} results for "{query}"
            </div>

            {results.map((result) => (
              <button
                className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors hover:border-biolum/50 hover:bg-biolum/10"
                key={result.id}
                onClick={() => onResultSelect?.(result.file, result.line)}
                type="button"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-biolum" />
                    <span className="font-mono text-sm">{result.file}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-xs",
                        result.score > 0.9
                          ? "text-green-400"
                          : result.score > 0.85
                            ? "text-yellow-400"
                            : "text-biolum-dim"
                      )}
                    >
                      {(result.score * 100).toFixed(0)}%
                    </span>
                    <ChevronRight className="h-4 w-4 text-biolum-dim" />
                  </div>
                </div>

                <div className="mb-1 font-mono text-biolum-dim text-xs">
                  Line {result.line}
                </div>

                <code className="block rounded bg-void p-2 font-mono text-xs">
                  {result.content}
                </code>

                <p className="mt-2 text-biolum-dim text-xs">{result.context}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-biolum-dim">
            <div>
              <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>Enter a natural language query to search code</p>
              <p className="mt-1 text-xs">Powered by @alfred/embed</p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
