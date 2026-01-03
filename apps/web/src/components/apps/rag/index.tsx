"use client";

/**
 * RAG Explorer - Debug and explore RAG retrieval
 *
 * Embeddings, chunking, reranking, and similarity visualization.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.7
 */

import { Bug, Database, Eye, Network } from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { cn } from "@/lib/utils";
import { ChunkBrowser } from "./chunk-browser";
import { EmbeddingVisualizer } from "./embedding-visualizer";
import { RetrievalDebugger } from "./retrieval-debugger";
import { SimilarityExplorer } from "./similarity-explorer";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Chunk = {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, string>;
  embedding?: number[];
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function RagApp({ window: _window }: WindowComponentProps) {
  const [tab, setTab] = useState<
    "chunks" | "embeddings" | "debug" | "similarity"
  >("chunks");

  return (
    <div className="flex h-full flex-col bg-void">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">RAG Explorer</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-white/5 border-b">
        {[
          { id: "chunks", icon: Database, label: "Chunks" },
          { id: "embeddings", icon: Eye, label: "Embeddings" },
          { id: "debug", icon: Bug, label: "Debug" },
          { id: "similarity", icon: Network, label: "Similarity" },
        ].map((t) => (
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-biolum border-b-2 text-biolum"
                : "text-biolum-dim hover:text-biolum"
            )}
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            type="button"
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "chunks" && <ChunkBrowser />}
        {tab === "embeddings" && <EmbeddingVisualizer />}
        {tab === "debug" && <RetrievalDebugger />}
        {tab === "similarity" && <SimilarityExplorer />}
      </div>
    </div>
  );
}

export function RagAppWindow(props: WindowComponentProps) {
  return <RagApp {...props} />;
}
