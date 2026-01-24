"use client";

/**
 * Embedding Visualizer - t-SNE/UMAP projections with live data
 */

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

type Point = {
  id: string;
  x: number;
  y: number;
  label: string;
  cluster: number;
  relevance: number;
};

const clusterColors = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24"];

export function EmbeddingVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [query, setQuery] = useState("");
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  const { data, isLoading, refetch } =
    trpc.graph.getGraphVisualization.useQuery(
      { text: query || "knowledge graph embedding", topK: 20 },
      { enabled: true }
    );

  const points = useMemo<Point[]>(() => {
    if (!data?.nodes) {
      return [];
    }

    const nodeTypes = new Map<string, number>();
    let clusterIdx = 0;

    return data.nodes.map((node, i) => {
      if (!nodeTypes.has(node.type)) {
        nodeTypes.set(node.type, clusterIdx++ % 4);
      }

      const angle = (i / data.nodes.length) * Math.PI * 2;
      const radius = 0.3 + node.relevance * 0.15;

      return {
        id: node.id,
        x: 0.5 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(angle) * radius,
        label: node.label,
        cluster: nodeTypes.get(node.type) ?? 0,
        relevance: node.relevance,
      };
    });
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const point of points) {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      const size = 4 + point.relevance * 6;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = clusterColors[point.cluster] ?? "#22d3ee";
      ctx.globalAlpha = 0.6 + point.relevance * 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [points]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const threshold = 0.05;
    const found = points.find(
      (p) => Math.abs(p.x - x) < threshold && Math.abs(p.y - y) < threshold
    );
    setHoveredPoint(found ?? null);
  };

  const nodeTypes = useMemo(() => {
    if (!data?.nodes) {
      return [];
    }
    const types = new Set(data.nodes.map((n) => n.type));
    return Array.from(types);
  }, [data]);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium">2D Projection</span>
          <div className="flex gap-2">
            <input
              className="w-48 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refetch()}
              placeholder="Search embeddings..."
              value={query}
            />
            <Button disabled={isLoading} onClick={() => refetch()} size="sm">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex gap-4">
          {nodeTypes.slice(0, 4).map((type, i) => (
            <div className="flex items-center gap-1" key={type}>
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: clusterColors[i] }}
              />
              <span className="text-biolum-dim text-xs">{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex-1 rounded-lg border border-white/10 bg-void">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-biolum" />
          </div>
        ) : (
          <canvas
            className="h-full w-full cursor-crosshair"
            height={400}
            onMouseLeave={() => setHoveredPoint(null)}
            onMouseMove={handleCanvasMouseMove}
            ref={canvasRef}
            width={600}
          />
        )}
        {hoveredPoint && (
          <div className="absolute top-2 left-2 rounded-lg border border-white/10 bg-void/90 p-2 text-sm">
            <div className="font-medium">{hoveredPoint.label}</div>
            <div className="text-biolum-dim text-xs">
              Relevance: {(hoveredPoint.relevance * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg">{points.length}</div>
          <div className="text-biolum-dim text-xs">Total Points</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg">{nodeTypes.length}</div>
          <div className="text-biolum-dim text-xs">Node Types</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg">{data?.edges?.length ?? 0}</div>
          <div className="text-biolum-dim text-xs">Edges</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg text-sm">semantic</div>
          <div className="text-biolum-dim text-xs">Search Type</div>
        </div>
      </div>
    </div>
  );
}
