import type { NodeProps } from "@xyflow/react";

import { Brain, Play, Sparkles } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useDesktopStore } from "@/store/desktop";

const knowledgeWindowDataSchema = z.object({
  type: z.literal("knowledge"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  resourceRef: z
    .object({
      type: z.literal("knowledge"),
      id: z.string(),
    })
    .optional(),
  kind: z.string().optional(),
  source: z.string().optional(),
  confidence: z.number().optional(),
  archived: z.boolean().optional(),
  summary: z.string().optional(),
});

function getConfidenceStyle(confidence?: number, archived?: boolean) {
  if (archived) {
    return {
      container: "opacity-50",
      border: "border-red-500/30",
      text: "text-red-300",
    };
  }
  if (typeof confidence !== "number") {
    return { container: "", border: "border-white/10", text: "text-white" };
  }
  if (confidence >= 0.8) {
    return {
      container: "",
      border: "border-emerald-500/30",
      text: "text-white",
    };
  }
  if (confidence >= 0.5) {
    return { container: "", border: "border-amber-500/30", text: "text-white" };
  }
  return { container: "", border: "border-red-500/30", text: "text-red-200" };
}

export function KnowledgeWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = knowledgeWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "knowledge" as const, viewMode: "full" as const };

  const kind = (windowData.kind ?? "fact").toUpperCase();
  const isRag = windowData.source === "rag";
  const confidence =
    typeof windowData.confidence === "number"
      ? `${Math.round(windowData.confidence * 100)}%`
      : null;

  const confidenceStyle = getConfidenceStyle(
    windowData.confidence,
    windowData.archived
  );

  const spawnWindow = useDesktopStore((s) => s.spawnWindow);

  const handleLaunchWorkflow = () => {
    if (!isRag) {
      return;
    }
    spawnWindow("workflow");
  };

  if (lod === "tiny") {
    return (
      <TinyDot
        color={isRag ? "bg-emerald-500" : "bg-blue-500"}
        shadow={isRag ? "shadow-emerald-500/50" : "shadow-blue-500/50"}
      />
    );
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor={isRag ? "border-emerald-500/30" : "border-blue-500/30"}
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
        label={windowData.label ?? "Knowledge"}
        textColor={isRag ? "text-emerald-400" : "text-blue-400"}
      />
    );
  }

  return (
    <WindowFrame
      actions={
        isRag ? (
          <Sparkles className="h-4 w-4 text-emerald-300" />
        ) : (
          <Brain className="h-4 w-4 text-blue-300" />
        )
      }
      id={id}
      selected={selected}
      title={windowData.label ?? "Knowledge"}
      width={320}
      windowType="knowledge"
    >
      <div className={`flex flex-col gap-3 p-4 ${confidenceStyle.container}`}>
        <div className="flex items-center justify-between text-white/60 text-xs uppercase tracking-widest">
          <span className="flex items-center gap-1">
            {isRag && (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <Sparkles className="h-3 w-3" />
              </span>
            )}
            <span>{kind}</span>
          </span>
          <div className="flex items-center gap-2">
            {windowData.archived && (
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
                ARCHIVED
              </span>
            )}
            {confidence && (
              <span
                className={`rounded bg-white/10 px-2 py-0.5 text-[10px] ${
                  (windowData.confidence ?? 1) < 0.5 ? "text-red-200" : ""
                }`}
              >
                {confidence}
              </span>
            )}
          </div>
        </div>

        {windowData.summary && (
          <p className="line-clamp-4 text-sm text-white/70">
            {windowData.summary}
          </p>
        )}

        {isRag && (
          <Button
            className="mt-2 self-start"
            onClick={handleLaunchWorkflow}
            size="sm"
            variant="outline"
          >
            <Play className="mr-1 h-3 w-3" />
            Use in Workflow
          </Button>
        )}
      </div>
    </WindowFrame>
  );
}
