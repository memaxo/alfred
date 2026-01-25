"use client";

import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

export interface TermLine {
  id: string;
  text: string;
  channel?: "stdout" | "stderr" | "system";
}

export interface TermProps {
  title?: string;
  lines: TermLine[];
  empty?: ReactNode;
  className?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  maxHeight?: number;
}

export function Term({
  title,
  lines,
  empty,
  className,
  scrollRef,
  maxHeight = 240,
}: TermProps) {
  return (
    <div
      className={cn("rounded-lg border border-white/10 bg-zinc-950", className)}
    >
      {title && (
        <div className="border-white/10 border-b px-3 py-2 text-biolum-dim text-xs">
          {title}
        </div>
      )}
      <div
        className="overflow-auto p-3 font-mono text-xs"
        ref={scrollRef}
        style={{ maxHeight }}
      >
        <div className="space-y-0.5">
          {lines.map((line) => (
            <div
              className={cn(
                line.channel === "stderr" && "text-red-400",
                line.channel === "system" && "text-biolum-dim",
                (!line.channel || line.channel === "stdout") && "text-zinc-300"
              )}
              key={line.id}
            >
              {line.text}
            </div>
          ))}
          {lines.length === 0 &&
            (empty ?? (
              <div className="text-biolum-faint italic">No output yet</div>
            ))}
        </div>
      </div>
    </div>
  );
}
