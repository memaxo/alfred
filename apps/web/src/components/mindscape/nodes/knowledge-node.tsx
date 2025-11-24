import type { NodeProps } from "@xyflow/react";
import { Brain, Play, Sparkles } from "lucide-react";
import type { KnowledgeNodeData } from "@/store/mindscape";
import { useMindscapeStore } from "@/store/mindscape";
import { useLOD, useNodeFocus } from "../lod";
import { createSpawnNode } from "../spawn";
import { getConfidenceStyle } from "../utils";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

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
      <NodeLODTiny
        className={confidenceStyle.container}
        color={isRag ? "bg-emerald-500" : "bg-blue-500"}
        shadow={isRag ? "shadow-emerald-500/50" : "shadow-blue-500/50"}
      />
    );
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor={isRag ? "border-emerald-500/30" : "border-blue-500/30"}
        className={confidenceStyle.container}
        hoverColor={
          isRag ? "hover:border-emerald-500/50" : "hover:border-blue-500/50"
        }
        icon={
          isRag ? (
            <Sparkles className="h-3 w-3" />
          ) : (
            <Brain className="h-3 w-3" />
          )
        }
        label={data.label ?? "Knowledge"}
        textColor={isRag ? "text-emerald-400" : "text-blue-400"}
      />
    );
  }

  // LOD 2/3: Medium/Full (Existing Card)
  const borderClass = isRag
    ? "border-emerald-400/60"
    : selected
      ? "border-biolum"
      : confidenceStyle.border;

  const textClass = isRag
    ? "text-emerald-50"
    : selected
      ? "text-biolum"
      : confidenceStyle.text;

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
            <span
              className={`rounded bg-white/10 px-2 py-0.5 text-[10px] ${
                (data.confidence ?? 1) < 0.5 ? "text-red-200" : ""
              }`}
            >
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
