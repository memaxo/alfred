import { AlertTriangle, BookOpen, Info, Network, Sparkles } from "lucide-react";
import { Ctx } from "@/components/ctx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatRelativeTime } from "@/lib/time";

export function ContextLens({
  label,
  ragDocuments,
  isLoading,
  isError,
  contextSnapshot,
  runtimeContext,
}: {
  label: string;
  ragDocuments: Array<{
    label: string;
    summary: string;
    source: "vector" | "graph";
  }>;
  isLoading: boolean;
  isError: boolean;
  contextSnapshot?: {
    status: "cache" | "live";
    summary?: string;
    timestamp: Date;
  } | null;
  runtimeContext?: Record<string, unknown> | null;
}) {
  // Determine trigger appearance
  let Icon = Info;
  let borderColor = "border-indigo-500/20";
  let bgHover = "hover:bg-indigo-500/20";
  let textColor = "text-indigo-300";
  let iconColor = "text-indigo-200";
  let animate = "";

  if (contextSnapshot?.status === "cache") {
    Icon = Sparkles;
    borderColor = "border-emerald-400/30";
    bgHover = "hover:bg-emerald-500/20";
    textColor = "text-emerald-200";
    iconColor = "text-emerald-300";
    animate = "animate-pulse";
  } else if (isError) {
    Icon = AlertTriangle;
    borderColor = "border-amber-500/20";
    bgHover = "hover:bg-amber-500/20";
    textColor = "text-amber-300";
    iconColor = "text-amber-300";
  } else if (ragDocuments.length > 0) {
    Icon = Sparkles;
    animate = "animate-pulse";
  } else if (isLoading) {
    // Optional: spinner or pulse effect
    animate = "animate-pulse";
  }

  // A11y: Use Popover for better keyboard/screen reader support than HoverCard for interactive content.
  // The trigger button has a descriptive aria-label.
  const contextCount = ragDocuments.length;
  const contextStatusLabel = contextSnapshot
    ? contextSnapshot.status === "cache"
      ? "Cached context"
      : "Fresh context"
    : "Active context";
  const a11yLabel = isError
    ? `Context retrieval unavailable for ${label}`
    : `${contextStatusLabel}: ${label}, ${contextCount} related documents available. Click to view details.`;

  // Sort documents to show Graph edges first
  const sortedDocs = [...ragDocuments].sort((a, b) => {
    if (a.source === b.source) {
      return 0;
    }
    return a.source === "graph" ? -1 : 1;
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={a11yLabel}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border bg-indigo-500/10 px-2 py-0.5 text-[10px] transition-colors ${borderColor} ${bgHover} ${textColor} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
        >
          <Icon className={`h-3 w-3 ${iconColor} ${animate}`} />
          <span>
            Context: {label}
            {contextSnapshot &&
              ` (${contextSnapshot.status === "cache" ? "cache" : "live"})`}
          </span>
          {!isError && ragDocuments.length > 0 && (
            <span className="ml-0.5 rounded bg-indigo-500/20 px-1 font-medium text-[9px] text-indigo-100">
              {ragDocuments.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-white/10 bg-void-surface/60 p-0 backdrop-blur-xl">
        <div className="border-white/5 border-b bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <h4 className="font-medium text-white text-xs">Active Context</h4>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-3">
          <div className="mb-3 text-[11px] text-white/50">
            Focusing on <span className="text-indigo-300">{label}</span>.
            {isError ? (
              <span className="mt-1 block text-amber-400">
                Context retrieval unavailable.
              </span>
            ) : ragDocuments.length > 0 ? (
              " Related knowledge retrieved automatically:"
            ) : (
              " No related documents found."
            )}
          </div>
          {contextSnapshot && (
            <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-xs">
                  {contextSnapshot.status === "cache"
                    ? "Cache Hit"
                    : "Fresh Scan"}
                </span>
                <span className="text-[10px] text-white/60">
                  {formatRelativeTime(contextSnapshot.timestamp)}
                </span>
              </div>
              {contextSnapshot.summary && (
                <p className="mt-1 text-[10px] text-white/60">
                  {contextSnapshot.summary}
                </p>
              )}
            </div>
          )}
          {sortedDocs.length > 0 && (
            <div className="space-y-2">
              {sortedDocs.map((doc, i) => (
                <div
                  className={`group rounded-lg border p-2 transition-colors hover:bg-white/10 ${doc.source === "graph" ? "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/30" : "border-white/5 bg-white/5 hover:border-white/10"}`}
                  key={i}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    {doc.source === "graph" && (
                      <Network className="h-3 w-3 text-indigo-400" />
                    )}
                    <span
                      className={`font-medium text-[11px] ${doc.source === "graph" ? "text-indigo-300" : "text-indigo-200"}`}
                    >
                      {doc.label}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-[10px] text-white/60">
                    {doc.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
          {runtimeContext && Object.keys(runtimeContext).length > 0 ? (
            <div className="mt-3">
              <Ctx
                className="border-white/10 bg-white/5"
                runtimeContext={runtimeContext}
              />
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
