import type { NodeProps } from "@xyflow/react";
import type { KnowledgeNodeData } from "@/store/mindscape";

export function KnowledgeNode({
  data,
  selected,
}: NodeProps<KnowledgeNodeData>) {
  const kind = (data.kind ?? "fact").toUpperCase();
  const confidence =
    typeof data.confidence === "number"
      ? `${Math.round(data.confidence * 100)}%`
      : null;

  return (
    <div
      className={`min-w-[220px] rounded-xl border px-4 py-3 text-left bg-void-surface/80 backdrop-blur ${
        selected ? "border-biolum text-biolum" : "border-white/10 text-white/80"
      }`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
        <span>{kind}</span>
        {confidence && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px]">
            {confidence}
          </span>
        )}
      </div>
      <div className="mt-2 text-base font-semibold text-white">
        {data.label ?? "Knowledge"}
      </div>
      {data.summary && (
        <p className="mt-2 text-sm text-white/70 line-clamp-3">
          {data.summary}
        </p>
      )}
      {data.graph?.hgHash && (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-white/40">
          Hash: {data.graph.hgHash.slice(0, 8)}
        </p>
      )}
    </div>
  );
}
