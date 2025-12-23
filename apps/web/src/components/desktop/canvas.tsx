"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowProps,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { edgeTypes, windowTypes } from "@/components/windows/registry";
import { useDesktopStore } from "@/store/desktop";

type DesktopCanvasProps = Omit<
  ReactFlowProps,
  "nodes" | "edges" | "onNodesChange" | "onEdgesChange" | "onConnect"
> & {
  onWorkflowNavigate?: (runId: string) => void;
};

export function DesktopCanvas(props: DesktopCanvasProps) {
  return (
    <ReactFlowProvider>
      <DesktopCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function DesktopCanvasInner({
  onWorkflowNavigate,
  ...props
}: DesktopCanvasProps) {
  const {
    windows,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addWindow,
    focusWindow,
  } = useDesktopStore(
    useShallow((state) => ({
      windows: state.windows,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      addWindow: state.addWindow,
      focusWindow: state.focusWindow,
    }))
  );

  const reactFlow = useReactFlow();

  const focusAndCenter = useCallback(
    (windowId: string) => {
      focusWindow(windowId);
      requestAnimationFrame(() => {
        try {
          reactFlow.fitView({
            nodes: [{ id: windowId }],
            duration: 400,
            padding: 0.4,
          });
        } catch {
          // Ignore fitView errors
        }
      });
    },
    [focusWindow, reactFlow]
  );

  const { visibleWindows, visibleEdges } = useMemo(
    () => ({ visibleWindows: windows, visibleEdges: edges }),
    [windows, edges]
  );

  useEffect(() => {
    if (windows.length === 0) {
      addWindow({
        id: "chat-default",
        type: "chat",
        position: { x: 0, y: 0 },
        data: {
          type: "chat",
          label: "Chat",
          viewMode: "full",
        },
      });
    }
  }, [windows.length, addWindow]);

  return (
    <div className="relative h-screen w-full bg-void">
      <ReactFlow
        colorMode="dark"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        edges={visibleEdges}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{
          minZoom: 0.8,
          maxZoom: 1.5,
          padding: 0.3,
        }}
        maxZoom={4}
        minZoom={0.1}
        nodes={visibleWindows}
        nodeTypes={windowTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        panOnDrag={true}
        panOnScroll={false}
        proOptions={{ hideAttribution: true }}
        selectionOnDrag={true}
        {...props}
        onNodeClick={(_, node) => {
          focusAndCenter(node.id);
        }}
      >
        <Background
          className="opacity-50"
          color="#333"
          gap={50}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <Controls className="border-white/10 bg-void-surface text-biolum" />
        <MiniMap
          className="border-white/10 bg-void-surface"
          maskColor="rgba(0, 0, 0, 0.6)"
          nodeColor="#A855F7"
        />
      </ReactFlow>
    </div>
  );
}
