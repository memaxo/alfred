import type { NodeProps } from "@xyflow/react";

import { Brain, Network } from "lucide-react";
import { z } from "zod";

import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";

const conceptWindowDataSchema = z.object({
  type: z.literal("concept"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  resourceRef: z
    .object({
      type: z.literal("concept"),
      id: z.string(),
    })
    .optional(),
  entityType: z.string().optional(),
  confidence: z.number().optional(),
  archived: z.boolean().optional(),
  description: z.string().optional(),
  hgHash: z.string().optional(),
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
      border: "border-indigo-500/30",
      text: "text-white",
    };
  }
  if (confidence >= 0.5) {
    return { container: "", border: "border-amber-500/30", text: "text-white" };
  }
  return { container: "", border: "border-red-500/30", text: "text-red-200" };
}

export function ConceptWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = conceptWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "concept" as const, viewMode: "full" as const };

  const entityType = (windowData.entityType ?? "concept").toUpperCase();
  const confidence =
    typeof windowData.confidence === "number"
      ? `${Math.round(windowData.confidence * 100)}%`
      : null;

  const confidenceStyle = getConfidenceStyle(
    windowData.confidence,
    windowData.archived
  );

  if (lod === "tiny") {
    return <TinyDot color="bg-indigo-500" shadow="shadow-indigo-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-indigo-500/30"
        hoverColor="hover:border-indigo-500/50"
        icon={<Network className="h-3 w-3" />}
        label={windowData.label ?? "Concept"}
        textColor="text-indigo-400"
      />
    );
  }

  return (
    <WindowFrame
      actions={<Network className="h-4 w-4 text-indigo-300" />}
      id={id}
      selected={selected}
      title={windowData.label ?? "Concept"}
      width={300}
      windowType="concept"
    >
      <div className={`flex flex-col gap-3 p-4 ${confidenceStyle.container}`}>
        <div className="flex items-center justify-between text-[10px] text-white/50 uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
              <Network className="h-2.5 w-2.5" />
            </span>
            <span>{entityType}</span>
          </span>
          <div className="flex items-center gap-2">
            {windowData.archived && (
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
                ARCHIVED
              </span>
            )}
            {confidence && (
              <span
                className={`font-mono text-[9px] opacity-70 ${
                  (windowData.confidence ?? 1) < 0.5 ? "text-red-200" : ""
                }`}
              >
                {confidence}
              </span>
            )}
          </div>
        </div>

        {windowData.description && (
          <p className="line-clamp-3 text-white/60 text-xs leading-relaxed">
            {windowData.description}
          </p>
        )}

        {windowData.hgHash && (
          <div className="mt-1 flex items-center gap-1 border-white/5 border-t pt-2 font-mono text-[9px] text-white/30">
            <Brain className="h-2.5 w-2.5" />
            <span>{windowData.hgHash.slice(0, 8)}</span>
          </div>
        )}
      </div>
    </WindowFrame>
  );
}
