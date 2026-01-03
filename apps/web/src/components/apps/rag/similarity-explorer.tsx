"use client";

/**
 * Similarity Explorer - Explore embedding similarities
 */

import { Network } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SimilarityPair = {
  id1: string;
  id2: string;
  similarity: number;
  label1: string;
  label2: string;
};

const mockPairs: SimilarityPair[] = [
  {
    id1: "chunk-1",
    id2: "chunk-4",
    similarity: 0.89,
    label1: "ALFRED overview",
    label2: "Cognitive loop",
  },
  {
    id1: "chunk-1",
    id2: "chunk-2",
    similarity: 0.82,
    label1: "ALFRED overview",
    label2: "Desktop shell",
  },
  {
    id1: "chunk-2",
    id2: "chunk-3",
    similarity: 0.71,
    label1: "Desktop shell",
    label2: "ReactFlow isolation",
  },
  {
    id1: "chunk-3",
    id2: "chunk-4",
    similarity: 0.45,
    label1: "ReactFlow isolation",
    label2: "Cognitive loop",
  },
];

export function SimilarityExplorer() {
  const [selectedPair, setSelectedPair] = useState<SimilarityPair | null>(null);

  return (
    <div className="flex h-full">
      {/* Similarity List */}
      <div className="w-80 border-white/5 border-r">
        <div className="border-white/5 border-b p-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-biolum" />
            <span className="font-medium text-sm">Similarity Pairs</span>
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="space-y-2 p-2">
            {mockPairs.map((pair) => (
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
                  <div className="truncate text-biolum-dim">{pair.label2}</div>
                </div>
              </button>
            ))}
          </div>
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
                Similarity Breakdown
              </div>
              <div className="space-y-2">
                {[
                  { label: "Semantic", value: selectedPair.similarity },
                  { label: "Lexical", value: selectedPair.similarity * 0.8 },
                  { label: "Structural", value: selectedPair.similarity * 0.9 },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-biolum-dim">{item.label}</span>
                      <span>{(item.value * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-biolum"
                        style={{ width: `${item.value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
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
