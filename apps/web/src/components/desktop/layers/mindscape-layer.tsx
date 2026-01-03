"use client";

/**
 * Mindscape Layer - ReactFlow infinite canvas wrapper
 *
 * This layer wraps the ReactFlow-based Mindscape canvas.
 * It's lazily loaded and only rendered when in mindscape mode.
 *
 * ReactFlow imports are allowed here as this is within the isolation boundary.
 *
 * @see docs/execplans/desktop-type-migration.md
 */

import { type CSSProperties, lazy, Suspense } from "react";

// Lazy load the actual ReactFlow canvas to keep main bundle small
const MindscapeCanvas = lazy(() =>
  import("@/components/graphs/mindscape/canvas")
    .then((m) => ({
      default: m.MindscapeCanvas,
    }))
    .catch(() => ({
      // Fallback if canvas doesn't exist yet
      default: MindscapeCanvasPlaceholder,
    }))
);

type MindscapeLayerProps = {
  style?: CSSProperties;
  onWorkflowNavigate?: (runId: string) => void; // Reserved for Phase 6
};

function MindscapeCanvasPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-void">
      <div className="text-center text-biolum-dim">
        <p className="font-medium text-lg">Mindscape</p>
        <p className="mt-1 text-sm">
          Infinite canvas for knowledge exploration
        </p>
        <p className="mt-2 text-xs opacity-50">Coming in Phase 6</p>
      </div>
    </div>
  );
}

function MindscapeLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-void">
      <div className="animate-pulse text-biolum-dim">Loading Mindscape...</div>
    </div>
  );
}

export function MindscapeLayer({
  style,
  onWorkflowNavigate: _onWorkflowNavigate,
}: MindscapeLayerProps) {
  return (
    <div
      className="absolute inset-0"
      data-layer="mindscape"
      style={{
        ...style,
        top: 32, // Below menu bar
        bottom: 48, // Above taskbar
      }}
    >
      <Suspense fallback={<MindscapeLoading />}>
        <MindscapeCanvas />
      </Suspense>
    </div>
  );
}
