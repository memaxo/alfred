import type { NodeProps } from "@xyflow/react";
import { Sparkles, Play } from "lucide-react";
import type { KnowledgeNodeData } from "@/store/mindscape";
import { useMindscapeStore } from "@/store/mindscape";
import { createSpawnNode } from "../spawn";

export function KnowledgeNode({
  data,
  selected,
}: NodeProps<KnowledgeNodeData>) {
  const kind = (data.kind ?? "fact").toUpperCase();
  const isRag = data.source === "rag";
  const confidence =
    typeof data.confidence === "number"
      ? `${Math.round(data.confidence * 100)}%`
      : null;

  const handleLaunchWorkflow = () => {
    if (!isRag) return;

    const { nodes, addArtifact, focusNode, updateArtifactData } =
      useMindscapeStore.getState();

    const base = createSpawnNode("workflow", nodes.length);
    if (!base) {
      return;
    }

    const summary = data.summary ?? data.label ?? "RAG context";
    const requirement = `Use this context to help:\n\n${summary}`;

    const workflowNode = {
      ...base,
      data: {
        ...(base.data as any),
        label: "Workflow from RAG",
        requirement,
        description: summary,
        auto: (base.data as any)?.auto ?? "low",
        mode: (base.data as any)?.mode ?? "sequential",
      },
    };

    addArtifact(workflowNode);
    focusNode(workflowNode.id);

    updateArtifactData(workflowNode.id, {
      requirement,
      description: summary,
      label: "Workflow from RAG",
    } as any);
  };

  return (
    <div
      className={`min-w-[220px] rounded-xl border px-4 py-3 text-left bg-void-surface/80 backdrop-blur ${
        isRag
          ? "border-emerald-400/60 text-emerald-50"
          : selected
            ? "border-biolum text-biolum"
            : "border-white/10 text-white/80"
      }`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
        <span className="flex items-center gap-1">
          {isRag && (
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
            >
              <Sparkles className="h-3 w-3" />
            </span>
          )}
          <span>{kind}</span>
        </span>
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
      {isRag && (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-emerald-300">
          RAG Context
        </p>
      )}
      {isRag && (
        <button
          type="button"
          onClick={handleLaunchWorkflow}
          className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
        >
          <Play className="h-3 w-3" />
          Use in Workflow
        </button>
      )}
      {data.graph?.hgHash && (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-white/40">
          Hash: {data.graph.hgHash.slice(0, 8)}
        </p>
      )}
    </div>
  );
}
