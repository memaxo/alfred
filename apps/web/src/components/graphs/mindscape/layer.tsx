/**
 * Mindscape Layer - Desktop integration layer
 *
 * Provides overlay layer for transitioning between desktop and mindscape modes.
 */

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMindscapeStore } from "@/store/mindscape";

import { MindscapeCanvas } from "./index";

export function MindscapeLayer() {
  const isActive = useMindscapeStore((s) => s.isActive);
  const deactivate = useMindscapeStore((s) => s.deactivate);

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-void/98 transition-all duration-500",
        isActive ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* Header */}
      <div className="absolute top-0 right-0 left-0 z-10 flex h-12 items-center justify-between border-white/5 border-b bg-void-surface/80 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-biolum" />
          <span className="font-medium">Mindscape</span>
          <span className="text-biolum-dim text-sm">• Knowledge Graph</span>
        </div>

        <Button onClick={deactivate} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div className="h-full pt-12">
        <MindscapeCanvas />
      </div>
    </div>
  );
}
