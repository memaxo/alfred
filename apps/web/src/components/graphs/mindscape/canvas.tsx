"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDesktopStore } from "@/store/desktop";
import { type MindscapeNode, useMindscapeStore } from "@/store/mindscape";
import { trpc } from "@/utils/trpc";
import { KnowledgeEntityNode } from "../knowledge/entity-node";
import { FactEdge } from "../knowledge/fact-edge";

const nodeTypes = {
  knowledgeEntity: KnowledgeEntityNode,
};

const edgeTypes = {
  fact: FactEdge,
};

function MindscapeCanvasInner() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { fitView } = useReactFlow();

  const { nodes, edges, onNodesChange, onEdgesChange, selectNode, addNode } =
    useMindscapeStore(
      useShallow((s) => ({
        nodes: s.nodes,
        edges: s.edges,
        onNodesChange: s.onNodesChange,
        onEdgesChange: s.onEdgesChange,
        selectNode: s.selectNode,
        addNode: s.addNode,
      }))
    );

  const { spawnWindow, setMode, setFocusedWindow, restoreWindow, focusWindow } =
    useDesktopStore(
      useShallow((s) => ({
        spawnWindow: s.spawnWindow,
        setMode: s.setMode,
        setFocusedWindow: s.setFocusedWindow,
        restoreWindow: s.restoreWindow,
        focusWindow: s.focusWindow,
      }))
    );

  const { deactivate, removeNode } = useMindscapeStore(
    useShallow((s) => ({
      deactivate: s.deactivate,
      removeNode: s.removeNode,
    }))
  );

  const { data: stats } = trpc.knowledge.stats.useQuery(
    { resource: "user" },
    {
      refetchInterval: 30_000,
    }
  );

  const { data: entitiesData, isLoading: isLoadingEntities } =
    trpc.knowledge.entitiesList.useQuery(
      {
        resource: "user",
        search: searchQuery || undefined,
        kind: filterType === "all" ? undefined : filterType,
        limit: 50,
      },
      {
        refetchInterval: 30_000,
      }
    );

  const { data: insights } = trpc.knowledge.insightsList.useQuery(
    {
      resource: "user",
      limit: 10,
    },
    {
      refetchInterval: 60_000,
    }
  );

  const graphNodes = useMemo(() => {
    if (!entitiesData?.entities || entitiesData.entities.length === 0) {
      return [];
    }

    const angleStep = (2 * Math.PI) / entitiesData.entities.length;
    const baseRadius = 250;

    return entitiesData.entities.map((entity, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const radius = baseRadius + (index % 3) * 50;

      return {
        id: entity.id,
        type: "knowledgeEntity",
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        },
        data: {
          type: "entity" as const,
          entityId: entity.id,
          entityType: entity.type,
          label: entity.name,
          description: entity.description ?? undefined,
          confidence: entity.confidence ?? undefined,
        },
      };
    });
  }, [entitiesData]);

  useEffect(() => {
    if (graphNodes.length > 0 && nodes.length === 0) {
      graphNodes.forEach((node) => addNode(node));
      setTimeout(() => fitView({ padding: 0.3, duration: 500 }), 100);
    }
  }, [graphNodes, nodes.length, fitView, addNode]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: MindscapeNode) => {
      event.stopPropagation();
      selectNode(node.id);
    },
    [selectNode]
  );

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: MindscapeNode) => {
      event.stopPropagation();

      // Check if this is a window-type node with a source window
      if (node.data.type === "window" && node.data.sourceWindowId) {
        const windowId = node.data.sourceWindowId;
        restoreWindow(windowId);
        focusWindow(windowId);
        removeNode(node.id);
        deactivate();
        setMode("desktop");
        return;
      }

      // For knowledge entities, spawn a knowledge window
      const entityId = node.id;
      spawnWindow("knowledge", { type: "knowledge", id: entityId });
      setFocusedWindow(null);
      setMode("desktop");
    },
    [
      restoreWindow,
      focusWindow,
      removeNode,
      deactivate,
      setMode,
      spawnWindow,
      setFocusedWindow,
    ]
  );

  const uniqueEntityTypes = useMemo(() => {
    const types = new Set(entitiesData?.entities.map((e) => e.type) ?? []);
    return Array.from(types).sort();
  }, [entitiesData]);

  return (
    <div className="relative h-full w-full bg-void">
      <ReactFlow
        colorMode="dark"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        edges={edges}
        edgeTypes={edgeTypes}
        maxZoom={4}
        minZoom={0.1}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodesChange={onNodesChange}
        panOnScroll
        proOptions={{ hideAttribution: true }}
        selectionOnDrag
      >
        <Background
          className="opacity-30"
          color="#333"
          gap={40}
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

      <div className="absolute top-4 right-4 z-10 w-80 rounded-lg border border-white/10 bg-void-surface/95 p-4 backdrop-blur-sm">
        <div className="mb-4">
          <h3 className="font-semibold text-biolum">Knowledge Graph</h3>
          <p className="text-biolum-dim text-sm">
            {stats?.totalNodes ?? 0} entities, {stats?.relations ?? 0} relations
          </p>
        </div>

        <div className="mb-4">
          <input
            className="w-full rounded border border-white/10 bg-void px-3 py-2 text-sm text-white placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities..."
            type="text"
            value={searchQuery}
          />
        </div>

        <div className="mb-4">
          <select
            className="w-full rounded border border-white/10 bg-void px-3 py-2 text-sm text-white focus:border-biolum focus:outline-none"
            onChange={(e) => setFilterType(e.target.value)}
            value={filterType}
          >
            <option value="all">All Types</option>
            {uniqueEntityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {isLoadingEntities && (
          <div className="text-center text-biolum-dim text-sm">
            Loading entities...
          </div>
        )}

        {insights?.insights && insights.insights.length > 0 && (
          <div className="border-white/10 border-t pt-4">
            <h4 className="mb-2 font-medium text-biolum">Insights</h4>
            <div className="space-y-2">
              {insights.insights.map((insight) => (
                <div
                  className="rounded border border-white/5 bg-void/50 p-2"
                  key={insight.id}
                >
                  <p className="font-medium text-biolum text-xs">
                    {insight.title}
                  </p>
                  <p className="mt-1 text-biolum-dim text-xs">
                    {insight.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MindscapeCanvas() {
  return (
    <ReactFlowProvider>
      <MindscapeCanvasInner />
    </ReactFlowProvider>
  );
}
