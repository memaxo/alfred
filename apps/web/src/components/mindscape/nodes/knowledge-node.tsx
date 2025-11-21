import type { NodeProps } from "@xyflow/react";
import { Play, Sparkles } from "lucide-react";
import type { KnowledgeNodeData } from "@/store/mindscape";
import { useMindscapeStore } from "@/store/mindscape";
import { createSpawnNode } from "../spawn";

// To avoid circular deps if ConceptNode imports from somewhere else,
// we can duplicate the Badge logic or move it to a shared ui file.
// Given the constraints, I will duplicate the badge logic here for safety
// unless I can confirm ConceptNode exports it.
// ConceptNode does NOT export TopicBadge currently.
// I will add the badge logic here.

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

const TOPIC_STYLES: Record<
  string,
  { icon: ReactNode; color: string; label: string }
> = {
  coding: {
    icon: <Code className="h-3 w-3" />,
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    label: "Coding",
  },
  ai: {
    icon: <Brain className="h-3 w-3" />,
    color: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    label: "AI",
  },
  cybersecurity: {
    icon: <Lock className="h-3 w-3" />,
    color: "text-rose-400 bg-rose-400/10 border-rose-400/20",
    label: "Security",
  },
  politics: {
    icon: <Globe className="h-3 w-3" />,
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    label: "Politics",
  },
  news: {
    icon: <Newspaper className="h-3 w-3" />,
    color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    label: "News",
  },
  social_media: {
    icon: <Share2 className="h-3 w-3" />,
    color: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    label: "Social",
  },
  music: {
    icon: <Music className="h-3 w-3" />,
    color: "text-pink-400 bg-pink-400/10 border-pink-400/20",
    label: "Music",
  },
  movies: {
    icon: <Film className="h-3 w-3" />,
    color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    label: "Movies",
  },
};

function TopicBadge({ topic }: { topic: string }) {
  const style = TOPIC_STYLES[topic] ?? {
    icon: <Network className="h-3 w-3" />,
    color: "text-slate-400 bg-slate-400/10 border-slate-400/20",
    label: topic,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium text-[9px] uppercase tracking-wide ${style.color}`}
    >
      {style.icon}
      {style.label}
    </span>
  );
}

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
    if (!isRag) {
      return;
    }

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
      className={`min-w-[220px] rounded-xl border bg-void-surface/80 px-4 py-3 text-left backdrop-blur ${
        isRag
          ? "border-emerald-400/60 text-emerald-50"
          : selected
            ? "border-biolum text-biolum"
            : "border-white/10 text-white/80"
      }`}
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
        {confidence && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px]">
            {confidence}
          </span>
        )}
      </div>
      <div className="mt-2 font-semibold text-base text-white">
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
