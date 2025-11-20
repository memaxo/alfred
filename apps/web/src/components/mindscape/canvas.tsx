"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  Panel,
  ReactFlow,
  type ReactFlowProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMindscapeStore } from "@/store/mindscape";
import { MindscapeInitializer } from "./initializer";
import { ArtifactNode } from "./nodes/artifact-node";
import { ChatNode } from "./nodes/chat-node";
import { OrbNode } from "./nodes/orb-node";
import { TerminalNode } from "./nodes/terminal-node";
import { WorkflowNode } from "./nodes/workflow-node";
import { WorkflowManager } from "./workflow-manager";

const nodeTypes: NodeTypes = {
  orb: OrbNode,
  artifact: ArtifactNode,
  chat: ChatNode,
  workflow: WorkflowNode,
  terminal: TerminalNode,
};

type MindscapeCanvasProps = Omit<
  ReactFlowProps,
  "nodes" | "edges" | "onNodesChange" | "onEdgesChange" | "onConnect"
>;

export function MindscapeCanvas(props: MindscapeCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addArtifact } =
    useMindscapeStore(
      useShallow((state) => ({
        nodes: state.nodes,
        edges: state.edges,
        onNodesChange: state.onNodesChange,
        onEdgesChange: state.onEdgesChange,
        onConnect: state.onConnect,
        addArtifact: state.addArtifact,
      }))
    );

  // Initialize with Orb if empty
  useEffect(() => {
    if (nodes.length === 0) {
      addArtifact({
        id: "singularity",
        type: "orb",
        position: { x: 0, y: 0 },
        data: { label: "Singularity" },
        draggable: false, // The center doesn't move (relative to the universe)
        selectable: false,
      });
    }
  }, [nodes.length, addArtifact]);

  return (
    <div className="h-screen w-full bg-[oklch(0.05_0_0)]">
      <ReactFlow
        colorMode="dark"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        edges={edges}
        fitView
        maxZoom={4}
        minZoom={0.1}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        panOnDrag={true}
        panOnScroll={false}
        proOptions={{ hideAttribution: true }}
        selectionOnDrag={true}
        {...props}
      >
        <Background
          className="opacity-50"
          color="#333"
          gap={50}
          size={1} // Star-like
          variant={BackgroundVariant.Dots}
        />
        <Controls className="border-white/10 bg-void-surface text-biolum" />
        <MiniMap
          className="border-white/10 bg-void-surface"
          maskColor="rgba(0, 0, 0, 0.6)"
          nodeColor="#A855F7"
        />
        <Panel
          className="text-biolum-dim text-xs uppercase tracking-widest"
          position="top-center"
        >
          Symbiotic Mindscape v0.1
        </Panel>
        <MindscapeInitializer />
        <WorkflowManager />
      </ReactFlow>
    </div>
  );
}
