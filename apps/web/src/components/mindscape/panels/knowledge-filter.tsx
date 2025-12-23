/**
 * Knowledge Filter Panel
 *
 * Toggle visibility of runtime and RAG knowledge nodes.
 */

import { Panel } from "@xyflow/react";

export type KnowledgeFilterPanelProps = {
  showRuntimeKnowledge: boolean;
  showRagKnowledge: boolean;
  onRuntimeKnowledgeChange: (checked: boolean) => void;
  onRagKnowledgeChange: (checked: boolean) => void;
};

export function KnowledgeFilterPanel({
  showRuntimeKnowledge,
  showRagKnowledge,
  onRuntimeKnowledgeChange,
  onRagKnowledgeChange,
}: KnowledgeFilterPanelProps) {
  return (
    <Panel
      className="rounded-full border border-white/10 bg-void-surface/80 px-4 py-2 text-[10px] text-biolum-faint uppercase tracking-widest"
      position="top-right"
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-xs">Knowledge</span>
        <label className="flex items-center gap-1">
          <input
            aria-label="Toggle runtime knowledge"
            checked={showRuntimeKnowledge}
            className="h-3 w-3 accent-biolum"
            onChange={(event) => onRuntimeKnowledgeChange(event.target.checked)}
            type="checkbox"
          />
          <span className="text-[10px]">Runtime</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            aria-label="Toggle RAG knowledge"
            checked={showRagKnowledge}
            className="h-3 w-3 accent-emerald-400"
            onChange={(event) => onRagKnowledgeChange(event.target.checked)}
            type="checkbox"
          />
          <span className="text-[10px]">RAG</span>
        </label>
      </div>
    </Panel>
  );
}
