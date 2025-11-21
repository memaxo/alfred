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

export function ConceptNode({ data, selected }: NodeProps<ConceptNodeData>) {
  const entityType = (data.entityType ?? "concept").toUpperCase();
  const confidence =
    typeof data.confidence === "number"
      ? `${Math.round(data.confidence * 100)}%`
      : null;

  return (
    <div
      className={`min-w-[180px] max-w-[300px] rounded-xl border bg-void-surface/90 px-4 py-3 text-left backdrop-blur ${
        selected
          ? "border-biolum text-biolum shadow-biolum/20 shadow-lg"
          : "border-white/10 text-white/80 hover:border-white/20"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-[10px] text-white/50 uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
            <Network className="h-2.5 w-2.5" />
          </span>
          <span>{entityType}</span>
        </span>
        {confidence && (
          <span className="font-mono text-[9px] opacity-70">{confidence}</span>
        )}
      </div>

      <div className="break-words font-medium text-sm text-white tracking-tight">
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
