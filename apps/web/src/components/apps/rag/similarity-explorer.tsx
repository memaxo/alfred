/**
 * Similarity Explorer - Explore embedding similarities with live graph data
 */

import { Loader2, Network, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  relevance: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface SimilarityPair {
  id1: string;
  id2: string;
  similarity: number;
  label1: string;
  label2: string;
  edgeType: string;
}

export function SimilarityExplorer() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [selectedPair, setSelectedPair] = useState<SimilarityPair | null>(null);

  const { data, isLoading } = trpc.graph.getGraphVisualization.useQuery(
    { text: query || "knowledge", topK: 15 },
    { enabled: submitted || query.length === 0 }
  );

  const pairs = useMemo(() => {
    if (!(data?.nodes && data?.edges)) {
      return [];
    }

    const nodeMap = new Map<string, GraphNode>();
    data.nodes.forEach((n: GraphNode) => nodeMap.set(n.id, n));

    return (data.edges as GraphEdge[])
      .map((edge): SimilarityPair | null => {
        const node1 = nodeMap.get(edge.source);
        const node2 = nodeMap.get(edge.target);
        if (!(node1 && node2)) {
          return null;
        }

        return {
          id1: edge.source,
          id2: edge.target,
          similarity: edge.weight,
          label1: node1.label,
          label2: node2.label,
          edgeType: edge.type,
        };
      })
      .filter((p): p is SimilarityPair => p !== null)
      .sort((a, b) => b.similarity - a.similarity);
  }, [data]);

  const handleSearch = () => {
    if (query.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <div className="flex h-full">
      {/* Similarity List */}
      <div className="w-80 border-white/5 border-r">
        <div className="border-white/5 border-b p-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-biolum" />
            <span className="font-medium text-sm">Similarity Pairs</span>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search graph..."
              value={query}
            />
            <Button disabled={isLoading} onClick={handleSearch} size="sm">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-100px)]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-biolum" />
            </div>
          ) : pairs.length === 0 ? (
            <div className="p-4 text-center text-biolum-dim text-sm">
              No relationships found. Try a different search.
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {pairs.map((pair) => (
                <button
                  className={cn(
                    "w-full rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors",
                    selectedPair === pair && "border-biolum/50 bg-biolum/10"
                  )}
                  key={`${pair.id1}-${pair.id2}`}
                  onClick={() => setSelectedPair(pair)}
                  type="button"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-biolum-dim text-xs">
                      {pair.id1} ↔ {pair.id2}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm",
                        pair.similarity > 0.8
                          ? "text-green-400"
                          : pair.similarity > 0.6
                            ? "text-yellow-400"
                            : "text-biolum-dim"
                      )}
                    >
                      {(pair.similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-xs">
                    <div className="truncate">{pair.label1}</div>
                    <div className="truncate text-biolum-dim">
                      {pair.label2}
                    </div>
                  </div>
                  <div className="mt-1 rounded bg-white/5 px-1.5 py-0.5 text-biolum-dim text-xs">
                    {pair.edgeType}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Similarity Detail */}
      <div className="flex-1 p-4">
        {selectedPair ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mb-2 font-mono text-4xl text-biolum">
                {(selectedPair.similarity * 100).toFixed(1)}%
              </div>
              <div className="text-biolum-dim text-sm">Cosine Similarity</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-1 font-mono text-biolum-dim text-xs">
                  {selectedPair.id1}
                </div>
                <div className="font-medium">{selectedPair.label1}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-1 font-mono text-biolum-dim text-xs">
                  {selectedPair.id2}
                </div>
                <div className="font-medium">{selectedPair.label2}</div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">
                Relationship Info
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-biolum-dim">Type</span>
                  <span className="font-mono">{selectedPair.edgeType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-biolum-dim">Weight</span>
                  <span className="font-mono">
                    {selectedPair.similarity.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">
                Connection Strength
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-biolum transition-all"
                  style={{
                    width: `${Math.min(selectedPair.similarity * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            Select a pair to view similarity details
          </div>
        )}
      </div>
    </div>
  );
}
