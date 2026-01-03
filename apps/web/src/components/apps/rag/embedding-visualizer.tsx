"use client";

/**
 * Embedding Visualizer - t-SNE/UMAP projections
 */

import { useEffect, useRef } from "react";

type Point = {
  id: string;
  x: number;
  y: number;
  label: string;
  cluster: number;
};

// Mock 2D projection data
const mockPoints: Point[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `point-${i}`,
  x: Math.random() * 0.8 + 0.1,
  y: Math.random() * 0.8 + 0.1,
  label: `Chunk ${i + 1}`,
  cluster: Math.floor(Math.random() * 4),
}));

const clusterColors = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24"];

export function EmbeddingVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw points
    for (const point of mockPoints) {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = clusterColors[point.cluster] ?? "#22d3ee";
      ctx.fill();
    }
  }, []);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-medium">2D Projection (t-SNE)</span>
        <div className="flex gap-4">
          {["Cluster 0", "Cluster 1", "Cluster 2", "Cluster 3"].map(
            (label, i) => (
              <div className="flex items-center gap-1" key={label}>
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: clusterColors[i] }}
                />
                <span className="text-biolum-dim text-xs">{label}</span>
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex-1 rounded-lg border border-white/10 bg-void">
        <canvas
          className="h-full w-full"
          height={400}
          ref={canvasRef}
          width={600}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg">{mockPoints.length}</div>
          <div className="text-biolum-dim text-xs">Total Points</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg">4</div>
          <div className="text-biolum-dim text-xs">Clusters</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg">1536</div>
          <div className="text-biolum-dim text-xs">Dimensions</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <div className="font-mono text-lg">text-embedding-3</div>
          <div className="text-biolum-dim text-xs">Model</div>
        </div>
      </div>
    </div>
  );
}
