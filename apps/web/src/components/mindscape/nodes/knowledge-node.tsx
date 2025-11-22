import type { NodeProps } from "@xyflow/react";
import { Play, Sparkles, Brain, Code, Film, Globe, Lock, Music, Network, Newspaper, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import type { KnowledgeNodeData } from "@/store/mindscape";
import { useMindscapeStore } from "@/store/mindscape";
import { createSpawnNode } from "../spawn";
import { useLOD, useNodeFocus } from "../lod";
import { getConfidenceStyle } from "../utils";

// ... existing TOPIC_STYLES and TopicBadge ...

export function KnowledgeNode({
  id,
  data,
  selected,
}: NodeProps<KnowledgeNodeData>) {
  const lod = useLOD();
  useNodeFocus(id);

  const kind = (data.kind ?? "fact").toUpperCase();
  const isRag = data.source === "rag";
  const confidence =
    typeof data.confidence === "number"
      ? `${Math.round(data.confidence * 100)}%`
      : null;
  
  const confidenceStyle = getConfidenceStyle(data.confidence, data.archived);

  const handleLaunchWorkflow = () => {
    if (!isRag) return;
    const { nodes, addArtifact, focusNode, updateArtifactData } =
      useMindscapeStore.getState();

    const base = createSpawnNode("workflow", nodes.length);
    if (!base) return;

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

  // LOD 0: Tiny
  if (lod === "tiny") {
    return (
      <div className={`flex h-3 w-3 items-center justify-center rounded-full backdrop-blur-sm ${
        isRag ? "bg-emerald-500/40" : "bg-blue-500/40"
      } ${confidenceStyle.container}`}>
        <div className={`h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
          isRag ? "bg-emerald-400 shadow-emerald-500/50" : "bg-blue-400 shadow-blue-500/50"
        }`} />
      </div>
    );
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <div className={`flex items-center gap-2 rounded-full border bg-void-surface/40 px-3 py-1 backdrop-blur-md transition-colors ${
        isRag 
          ? "border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50" 
          : "border-blue-500/30 text-blue-400 hover:border-blue-500/50"
      } ${confidenceStyle.container}`}>
        {isRag ? <Sparkles className="h-3 w-3" /> : <Brain className="h-3 w-3" />}
        <span className="max-w-[120px] truncate font-medium text-[10px] tracking-tight">
          {data.label ?? "Knowledge"}
        </span>
      </div>
    );
  }

  // LOD 2/3: Medium/Full (Existing Card)
  const borderClass = isRag
    ? "border-emerald-400/60"
    : selected
      ? "border-biolum"
      : confidenceStyle.border;

  const textClass = isRag ? "text-emerald-50" : selected ? "text-biolum" : confidenceStyle.text;

  return (
    <div
      className={`min-w-[220px] rounded-xl border bg-void-surface/80 px-4 py-3 text-left backdrop-blur ${borderClass} ${textClass} ${confidenceStyle.container}`}
    >
      <div className="flex items-center justify-between text-white/60 text-xs uppercase tracking-widest">
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
        <div className="flex items-center gap-2">
          {data.archived && (
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
              ARCHIVED
            </span>
          )}
          {confidence && (
            <span className={`rounded bg-white/10 px-2 py-0.5 text-[10px] ${
              (data.confidence ?? 1) < 0.5 ? "text-red-200" : ""
            }`}>
              {confidence}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 font-semibold text-base">
        {data.label ?? "Knowledge"}
      </div>

      {data.topics && data.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.topics.map((topic) => (
            <TopicBadge key={topic} topic={topic} />
          ))}
        </div>
      )}

      {data.summary && (
        <p className="mt-2 line-clamp-3 text-sm text-white/70">
          {data.summary}
        </p>
      )}
      {isRag && (
        <p className="mt-2 text-[10px] text-emerald-300 uppercase tracking-wide">
          RAG Context
        </p>
      )}
      {isRag && (
        <button
          className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 font-medium text-[11px] text-emerald-200 hover:bg-emerald-500/20"
          onClick={handleLaunchWorkflow}
          type="button"
        >
          <Play className="h-3 w-3" />
          Use in Workflow
        </button>
      )}
      {data.graph?.hgHash && (
        <p className="mt-2 text-[10px] text-white/40 uppercase tracking-wide">
          Hash: {data.graph.hgHash.slice(0, 8)}
        </p>
      )}
    </div>
  );
}
