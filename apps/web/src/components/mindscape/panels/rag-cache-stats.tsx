/**
 * RAG Cache Statistics Panel
 *
 * Displays cache hit rate, entry count, and detailed stats in dev mode.
 */

import { Panel } from "@xyflow/react";
import { RAG_DOC_CACHE_LIMIT } from "@/store/mindscape";

export type RagCacheStatsPanelProps = {
  isTraversing: boolean;
  hitRate: number;
  entryCount: number;
  stats: {
    hits: number;
    misses: number;
    evictions: number;
  };
};

export function RagCacheStatsPanel({
  isTraversing,
  hitRate,
  entryCount,
  stats,
}: RagCacheStatsPanelProps) {
  return (
    <Panel
      className="rounded-full border border-white/10 bg-void-surface/80 px-4 py-2"
      position="bottom-right"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-[10px] text-biolum-dim uppercase tracking-widest">
            {isTraversing ? (
              <span className="animate-pulse text-emerald-400">
                Traversing...
              </span>
            ) : (
              "RAG Cache"
            )}
          </span>
          <div className="flex gap-2">
            <div className="flex flex-col items-end">
              <span className="font-mono text-biolum text-xs">{hitRate}%</span>
              <span className="text-[8px] text-biolum-dim">Hit Rate</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-biolum text-xs">
                {entryCount}/{RAG_DOC_CACHE_LIMIT}
              </span>
              <span className="text-[8px] text-biolum-dim">Entries</span>
            </div>
          </div>
        </div>
        {import.meta.env.DEV && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            <dt className="text-biolum-dim">Hits</dt>
            <dd className="text-right font-mono text-biolum">{stats.hits}</dd>
            <dt className="text-biolum-dim">Misses</dt>
            <dd className="text-right font-mono text-biolum">{stats.misses}</dd>
            <dt className="text-biolum-dim">Evictions</dt>
            <dd className="text-right font-mono text-biolum">
              {stats.evictions}
            </dd>
          </dl>
        )}
      </div>
    </Panel>
  );
}
