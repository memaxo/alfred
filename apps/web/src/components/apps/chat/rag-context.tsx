/**
 * RAG Context Display - Show retrieved context used for responses
 *
 * Displays document chunks that were retrieved and used as context
 * for generating the assistant's response.
 *
 * @see @alfred/rag package
 */

import {
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface RagContextProps {
  className?: string;
  messageId?: string;
  queryText?: string;
}

export function RagContext({
  className,
  messageId: _messageId,
  queryText,
}: RagContextProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);

  // Fetch RAG chunks when expanded and we have a query
  const { data, isLoading } = trpc.graph.getRagChunks.useQuery(
    { text: queryText ?? "alfred", topK: 5 },
    { enabled: expanded && Boolean(queryText) }
  );

  const chunks = data?.chunks ?? [];

  // Don't render if no query text and we haven't expanded yet
  if (!(queryText || expanded)) {
    return null;
  }

  return (
    <div
      className={cn("rounded-lg border border-white/10 bg-white/5", className)}
    >
      {/* Header */}
      <button
        className="flex w-full items-center justify-between p-3"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">RAG Context</span>
          {chunks.length > 0 && (
            <span className="rounded bg-biolum/20 px-1.5 py-0.5 text-biolum text-xs">
              {chunks.length} chunks
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-biolum-dim" />
        ) : (
          <ChevronDown className="h-4 w-4 text-biolum-dim" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-white/5 border-t">
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {!isLoading && chunks.length === 0 && (
            <div className="p-4 text-center text-biolum-dim text-sm">
              No context chunks found
            </div>
          )}
          {!isLoading && chunks.length > 0 && (
            <ScrollArea className="max-h-64">
              <div className="space-y-2 p-3">
                {chunks.map((chunk) => (
                  <div
                    className={cn(
                      "rounded-lg border border-white/10 bg-white/5 p-2 transition-colors",
                      selectedChunk === chunk.id &&
                        "border-biolum/50 bg-biolum/10"
                    )}
                    key={chunk.id}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-biolum" />
                        <span className="font-mono text-xs">
                          {chunk.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-mono text-xs",
                            chunk.score > 0.9
                              ? "text-green-400"
                              : (chunk.score > 0.8
                                ? "text-yellow-400"
                                : "text-biolum-dim")
                          )}
                        >
                          {(chunk.score * 100).toFixed(0)}%
                        </span>
                        <Button className="h-5 w-5" size="icon" variant="ghost">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <p className="line-clamp-2 text-biolum-dim text-xs">
                      {chunk.content}
                    </p>

                    {selectedChunk === chunk.id && chunk.metadata && (
                      <div className="mt-2 flex gap-2 text-xs">
                        {Object.entries(chunk.metadata)
                          .filter(([, value]) => value)
                          .map(([key, value]) => (
                            <span
                              className="rounded bg-white/10 px-1.5 py-0.5"
                              key={key}
                            >
                              {key}: {value}
                            </span>
                          ))}
                      </div>
                    )}

                    <button
                      className="mt-1 text-biolum text-xs hover:underline"
                      onClick={() =>
                        setSelectedChunk(
                          selectedChunk === chunk.id ? null : chunk.id
                        )
                      }
                      type="button"
                    >
                      {selectedChunk === chunk.id ? "Show less" : "Show more"}
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
