import { Info, Sparkles, BookOpen, AlertTriangle, Network } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ContextLens({
  label,
  ragDocuments,
  isLoading,
  isError
}: {
  label: string;
  ragDocuments: Array<{ label: string; summary: string; source: "vector" | "graph" }>;
  isLoading: boolean;
  isError: boolean;
}) {
  // Determine trigger appearance
  let Icon = Info;
  let borderColor = "border-indigo-500/20";
  let bgHover = "hover:bg-indigo-500/20";
  let textColor = "text-indigo-300";
  let iconColor = "text-indigo-200";
  let animate = "";

  if (isError) {
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
  const a11yLabel = isError 
    ? `Context retrieval unavailable for ${label}` 
    : `Active Context: ${label}, ${contextCount} related documents available. Click to view details.`;

  // Sort documents to show Graph edges first
  const sortedDocs = [...ragDocuments].sort((a, b) => {
      if (a.source === b.source) return 0;
      return a.source === "graph" ? -1 : 1;
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          aria-label={a11yLabel}
          className={`flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] border transition-colors cursor-pointer ${borderColor} ${bgHover} ${textColor} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
        >
          <Icon className={`h-3 w-3 ${iconColor} ${animate}`} />
          <span>Context: {label}</span>
          {!isError && ragDocuments.length > 0 && (
            <span className="ml-0.5 rounded bg-indigo-500/20 px-1 text-[9px] font-medium text-indigo-100">
              {ragDocuments.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-white/10 bg-void-surface/60 backdrop-blur-xl p-0">
        <div className="border-b border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <h4 className="text-xs font-medium text-white">Active Context</h4>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-3">
          <div className="mb-3 text-[11px] text-white/50">
            Focusing on <span className="text-indigo-300">{label}</span>.
            {isError ? (
               <span className="text-amber-400 block mt-1">
                 Context retrieval unavailable.
               </span>
            ) : ragDocuments.length > 0
              ? " Related knowledge retrieved automatically:"
              : " No related documents found."}
          </div>
          {sortedDocs.length > 0 && (
            <div className="space-y-2">
              {sortedDocs.map((doc, i) => (
                <div
                  key={i}
                  className={`group rounded-lg border p-2 transition-colors hover:bg-white/10 ${doc.source === 'graph' ? 'border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/30' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    {doc.source === 'graph' && <Network className="h-3 w-3 text-indigo-400" />}
                    <span className={`text-[11px] font-medium ${doc.source === 'graph' ? 'text-indigo-300' : 'text-indigo-200'}`}>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
