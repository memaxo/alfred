import type { NodeProps } from "@xyflow/react";
import {
  Brain,
  Code,
  Film,
  Globe,
  Lock,
  Music,
  Network,
  Newspaper,
  Share2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ConceptNodeData } from "@/store/mindscape";
import { useLOD, useNodeFocus } from "../lod";
import { getConfidenceStyle } from "../utils";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

// ... existing styles ...

export function ConceptNode({ id, data, selected }: NodeProps<ConceptNodeData>) {
  const lod = useLOD();
  useNodeFocus(id);

  const entityType = (data.entityType ?? "concept").toUpperCase();
  const confidence =
    typeof data.confidence === "number"
      ? `${Math.round(data.confidence * 100)}%`
      : null;
  
  const confidenceStyle = getConfidenceStyle(data.confidence, data.archived);

  // LOD 0: Tiny
  if (lod === "tiny") {
    return (
      <NodeLODTiny 
        color="bg-indigo-500" 
        shadow="shadow-indigo-500/50" 
        className={confidenceStyle.container} 
      />
    );
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        label={data.label ?? "Concept"}
        icon={<Network className="h-3 w-3" />}
        borderColor="border-indigo-500/30"
        textColor="text-indigo-400"
        hoverColor="hover:border-indigo-500/50"
        className={confidenceStyle.container}
      />
    );
  }

  // LOD 2/3: Medium/Full
  const borderClass = selected
    ? "border-biolum"
    : confidenceStyle.border;
  
  const textClass = selected ? "text-biolum" : confidenceStyle.text;

  return (
    <div
      className={`min-w-[180px] max-w-[300px] rounded-xl border bg-void-surface/90 px-4 py-3 text-left backdrop-blur ${borderClass} ${textClass} ${selected ? "shadow-biolum/20 shadow-lg" : "hover:border-white/20"} ${confidenceStyle.container}`}
    >
      <div className="mb-2 flex items-center justify-between text-[10px] text-white/50 uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
            <Network className="h-2.5 w-2.5" />
          </span>
          <span>{entityType}</span>
        </span>
        <div className="flex items-center gap-2">
          {data.archived && (
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
              ARCHIVED
            </span>
          )}
          {confidence && (
            <span className={`font-mono text-[9px] opacity-70 ${
              (data.confidence ?? 1) < 0.5 ? "text-red-200" : ""
            }`}>{confidence}</span>
          )}
        </div>
      </div>

      <div className="break-words font-medium text-sm tracking-tight">
        {data.label ?? "Unknown Concept"}
      </div>

      {data.topics && data.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.topics.map((topic) => (
            <TopicBadge key={topic} topic={topic} />
          ))}
        </div>
      )}

      {data.description && (
        <p className="mt-2 line-clamp-3 text-white/60 text-xs leading-relaxed">
          {data.description}
        </p>
      )}

      {data.graph?.hgHash && (
        <div className="mt-3 flex items-center gap-1 border-white/5 border-t pt-2 font-mono text-[9px] text-white/30">
          <Brain className="h-2.5 w-2.5" />
          <span>{data.graph.hgHash.slice(0, 8)}</span>
        </div>
      )}
    </div>
  );
}
