"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeProps,
  type NodeTypes,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type ReactFlowProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type React from "react";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useMindscapeStore, type ArtifactData } from "@/store/mindscape";
import { MindscapeInitializer } from "./initializer";
import { ArtifactNode } from "./nodes/artifact-node";
import { ChatNode } from "./nodes/chat-node";
import { CodeNode } from "./nodes/code-node";
import { NodeErrorBoundary } from "./nodes/error-boundary";
import { NoteNode } from "./nodes/note-node";
import { OrbNode } from "./nodes/orb-node";
import { ReminderNode } from "./nodes/reminder-node";
import { TimerNode } from "./nodes/timer-node";
import { BookmarkNode } from "./nodes/bookmark-node";
import { TodoNode } from "./nodes/todo-node";
import { TerminalNode } from "./nodes/terminal-node";
import { TicketNode } from "./nodes/ticket-node";
import { WorkflowNode } from "./nodes/workflow-node";
import { SettingsNode } from "./nodes/settings-node";
import { PrivacyNode } from "./nodes/privacy-node";
import { ProfileNode } from "./nodes/profile-node";
import { IntegrationsNode } from "./nodes/integrations-node";
import { WorkflowListNode } from "./nodes/workflow-list-node";
import { DeploymentNode } from "./nodes/deployment-node";
import { WorkflowManager } from "./workflow-manager";
import {
  createSpawnNode,
  formatSpawnLabel,
  singletonSpawnTypes,
  type MindscapeSpawnType,
  type MindscapeSearchParams,
} from "./spawn";
import { MindscapeCommandPalette } from "./command-palette";

// Wrap each node component with error boundary
const wrapWithErrorBoundary = (Component: React.ComponentType<NodeProps>) =>
  (props: NodeProps) => (
    <NodeErrorBoundary nodeId={props.id}>
      <Component {...props} />
    </NodeErrorBoundary>
  );

const nodeTypes: NodeTypes = {
  orb: wrapWithErrorBoundary(OrbNode),
  artifact: wrapWithErrorBoundary(ArtifactNode),
  chat: wrapWithErrorBoundary(ChatNode),
  workflow: wrapWithErrorBoundary(WorkflowNode),
  terminal: wrapWithErrorBoundary(TerminalNode),
  note: wrapWithErrorBoundary(NoteNode),
  reminder: wrapWithErrorBoundary(ReminderNode),
  ticket: wrapWithErrorBoundary(TicketNode),
  code: wrapWithErrorBoundary(CodeNode),
  timer: wrapWithErrorBoundary(TimerNode),
  bookmark: wrapWithErrorBoundary(BookmarkNode),
  todo: wrapWithErrorBoundary(TodoNode),
  settings: wrapWithErrorBoundary(SettingsNode),
  privacy: wrapWithErrorBoundary(PrivacyNode),
  profile: wrapWithErrorBoundary(ProfileNode),
  integrations: wrapWithErrorBoundary(IntegrationsNode),
  workflowlist: wrapWithErrorBoundary(WorkflowListNode),
  deployment: wrapWithErrorBoundary(DeploymentNode),
};

type MindscapeCanvasProps = Omit<
  ReactFlowProps,
  "nodes" | "edges" | "onNodesChange" | "onEdgesChange" | "onConnect"
> & {
  searchParams?: MindscapeSearchParams;
};

export function MindscapeCanvas(props: MindscapeCanvasProps) {
  return (
    <ReactFlowProvider>
      <MindscapeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function MindscapeCanvasInner({ searchParams, ...props }: MindscapeCanvasProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addArtifact,
    focusNode,
  } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      addArtifact: state.addArtifact,
      focusNode: state.focusNode,
    }))
  );

  const reactFlow = useReactFlow<ArtifactData>();

  // Initialize with Orb if empty
  useEffect(() => {
    if (nodes.length === 0) {
      addArtifact({
        id: "singularity",
        type: "orb",
        position: { x: 0, y: 0 },
        data: { label: "Singularity" },
        draggable: false,
        selectable: false,
      });
    }
  }, [nodes.length, addArtifact]);

  const focusAndCenter = useCallback(
    (nodeId: string) => {
      focusNode(nodeId);
      requestAnimationFrame(() => {
        try {
          reactFlow.fitView({
            nodes: [{ id: nodeId }],
            duration: 400,
            padding: 0.4,
          });
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn("Mindscape focus failed", error);
          }
        }
      });
    },
    [focusNode, reactFlow]
  );

  const nodeIdQuery = searchParams?.nodeId;
  const spawnQuery = searchParams?.spawn;

  const spawnNodeFromType = useCallback(
    (spawnType: MindscapeSpawnType): string | null => {
      if (!(spawnType in nodeTypes)) {
        toast.info(`${formatSpawnLabel(spawnType)} node is not available yet.`);
        return null;
      }

      if (singletonSpawnTypes.includes(spawnType)) {
        const existing = nodes.find((node) => node.type === spawnType);
        if (existing) {
          focusAndCenter(existing.id);
          return existing.id;
        }
      }

      const newNode = createSpawnNode(spawnType, nodes.length);
      if (!newNode) {
        toast.error(`Unable to spawn ${formatSpawnLabel(spawnType)} yet.`);
        return null;
      }

      addArtifact(newNode);
      focusAndCenter(newNode.id);
      return newNode.id;
    },
    [nodes, addArtifact, focusAndCenter]
  );

  // Deep link focus (?nodeId=...)
  useEffect(() => {
    if (!nodeIdQuery) {
      return;
    }

    const target = nodes.find((node) => node.id === nodeIdQuery);
    if (!target) {
      return;
    }

    focusAndCenter(nodeIdQuery);
    clearSearchParams(["nodeId"]);
  }, [nodeIdQuery, nodes, focusAndCenter]);

  // Spawn nodes via deep link (?spawn=...)
  useEffect(() => {
    if (!spawnQuery) {
      return;
    }

    spawnNodeFromType(spawnQuery);
    clearSearchParams(["spawn"]);
  }, [spawnQuery, spawnNodeFromType]);

  return (
    <>
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
            size={1}
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
      <MindscapeCommandPalette
        nodes={nodes}
        onFocus={focusAndCenter}
        onSpawn={spawnNodeFromType}
      />
    </>
  );
}

function clearSearchParams(keys: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  let changed = false;

  keys.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }
}
