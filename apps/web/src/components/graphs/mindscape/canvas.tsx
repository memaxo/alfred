"use client";

/**
 * Mindscape Canvas - ReactFlow infinite canvas placeholder
 *
 * This is a placeholder component for the Mindscape ReactFlow canvas.
 * The full implementation will come in Phase 6.
 *
 * This file is within the ReactFlow isolation boundary.
 *
 * @see docs/execplans/desktop-type-migration.md
 */

// ReactFlow imports are allowed in this directory
// import { ReactFlow, Background, Controls } from "@xyflow/react";
// import "@xyflow/react/dist/style.css";

export function MindscapeCanvas() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-void">
      <div className="text-center text-biolum-dim">
        <div className="mb-4 text-4xl">🌌</div>
        <p className="font-medium text-lg">Mindscape</p>
        <p className="mt-1 text-sm">
          Infinite canvas for knowledge exploration
        </p>
        <p className="mt-4 text-xs opacity-50">
          Press <kbd className="rounded bg-white/10 px-1.5 py-0.5">⌘`</kbd> to
          return to desktop
        </p>
      </div>
    </div>
  );
}
