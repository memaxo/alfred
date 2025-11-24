import { createFileRoute } from "@tanstack/react-router";
import { Background, type Edge, type Node, ReactFlow } from "@xyflow/react";
import { LivingEdge } from "@/components/mindscape/living-edge";
import "@xyflow/react/dist/style.css";

// Sample nodes
const nodes: Node[] = [
  {
    id: "source-1",
    position: { x: 100, y: 100 },
    data: { label: "Source" },
    style: { background: "#333", color: "#fff", borderRadius: "12px" },
  },
  {
    id: "target-1",
    position: { x: 400, y: 100 },
    data: { label: "Target (Idle)" },
    style: { background: "#333", color: "#fff", borderRadius: "12px" },
  },

  {
    id: "source-2",
    position: { x: 100, y: 250 },
    data: { label: "Source" },
    style: { background: "#333", color: "#fff", borderRadius: "12px" },
  },
  {
    id: "target-2",
    position: { x: 400, y: 250 },
    data: { label: "Target (Active)" },
    style: { background: "#333", color: "#fff", borderRadius: "12px" },
  },

  {
    id: "source-3",
    position: { x: 100, y: 400 },
    data: { label: "Source" },
    style: { background: "#333", color: "#fff", borderRadius: "12px" },
  },
  {
    id: "target-3",
    position: { x: 400, y: 400 },
    data: { label: "Target (RAG)" },
    style: { background: "#333", color: "#fff", borderRadius: "12px" },
  },
];

// Mock the active state by using the store or just props?
// LivingEdge reads from useMindscapeStore.
// To test visual states properly we might need to mock the store or just pass style props if LivingEdge respects them (which we fixed).

// However, LivingEdge *only* reads active state from store.
// We can't easily mock store state per-edge without a provider wrapper.
// But we CAN test the "RAG Highlight" style which is passed via props.

const edges: Edge[] = [
  // 1. Idle Edge (Default)
  {
    id: "edge-1",
    source: "source-1",
    target: "target-1",
    type: "living",
  },
  // 2. Active Edge (Simulated via store? Hard to do here without provider hack)
  // We'll skip active simulation for now or need a wrapper.
  {
    id: "edge-2",
    source: "source-2",
    target: "target-2",
    type: "living",
    // Manually override style to look active-ish if store fails
    style: { stroke: "var(--color-biolum)", strokeWidth: 2 },
  },
  // 3. RAG Highlight Edge (Green dashed)
  {
    id: "edge-3",
    source: "source-3",
    target: "target-3",
    type: "living",
    style: {
      stroke: "rgba(16, 185, 129, 0.6)",
      strokeDasharray: "4 2",
      strokeWidth: 1.5,
    },
  },
];

const edgeTypes = {
  living: LivingEdge,
};

function EdgesPreview() {
  return (
    <div className="h-screen w-full bg-void text-biolum">
      <div className="absolute top-4 left-4 z-10 rounded-3xl border border-white/10 bg-void-surface/80 p-4">
        <h1 className="mb-2 font-bold text-xl tracking-tighter">
          Living Edge Preview
        </h1>
        <p className="text-biolum-dim text-xs">
          Visual verification of edge states.
          <br />
          Note: "Active" pulse requires store integration.
        </p>
      </div>
      <ReactFlow
        colorMode="dark"
        edges={edges}
        edgeTypes={edgeTypes}
        fitView
        nodes={nodes}
      >
        <Background color="#333" gap={20} />
      </ReactFlow>
    </div>
  );
}

export const Route = createFileRoute("/dev/edges")({
  component: EdgesPreview,
});
