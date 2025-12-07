import type { Edge, Node } from "@xyflow/react";
import { useEffect, useRef } from "react";
import type { ArtifactData } from "@/store/mindscape";
import type {
  PhysicsEdge,
  PhysicsNode,
  WorkerMessage,
} from "@/workers/physics.worker";

// Import worker using Vite's syntax
import PhysicsWorker from "@/workers/physics.worker?worker";

export function usePhysicsWorker({
  nodes,
  edges,
  focusId,
  setNodes,
  active = true,
}: {
  nodes: Node<ArtifactData>[];
  edges: Edge[];
  focusId: string | null;
  setNodes: (
    updater:
      | Node<ArtifactData>[]
      | ((prev: Node<ArtifactData>[]) => Node<ArtifactData>[])
  ) => void;
  active?: boolean;
}) {
  const workerRef = useRef<Worker | null>(null);
  const latestPositions = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const rafRef = useRef<number>();

  // Initialize Worker
  useEffect(() => {
    const worker = new PhysicsWorker();
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === "TICK") {
        const updates = e.data.nodes as {
          id: string;
          position: { x: number; y: number };
        }[];
        updates.forEach((u) => {
          latestPositions.current.set(u.id, u.position);
        });
      }
    };

    worker.postMessage({ type: "START" });

    return () => {
      worker.postMessage({ type: "STOP" });
      worker.terminate();
    };
  }, []);

  // Sync State to Worker
  useEffect(() => {
    if (!workerRef.current) return;

    // Transform nodes to lightweight format
    const physicsNodes: PhysicsNode[] = nodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      type: n.type || "artifact",
      draggable: n.draggable,
      isDragging: n.dragging,
    }));

    const physicsEdges: PhysicsEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    workerRef.current.postMessage({
      type: "UPDATE_NODES",
      nodes: physicsNodes,
      edges: physicsEdges,
    } satisfies WorkerMessage);
  }, [nodes.length, edges.length]);

  // Sync Focus
  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: "UPDATE_FOCUS",
      focusId,
    } satisfies WorkerMessage);
  }, [focusId]);

  // Render Loop (Main Thread)
  useEffect(() => {
    if (!active) return;

    const loop = () => {
      if (latestPositions.current.size > 0) {
        setNodes((prevNodes: Node<ArtifactData>[]) => {
          let changed = false;
          const next = prevNodes.map((n: Node<ArtifactData>) => {
            const pos = latestPositions.current.get(n.id);
            if (!pos) return n;

            // Simple threshold to avoid react updates for micro-movements
            if (
              Math.abs(n.position.x - pos.x) < 0.5 &&
              Math.abs(n.position.y - pos.y) < 0.5
            ) {
              return n;
            }

            changed = true;
            return { ...n, position: { x: pos.x, y: pos.y } };
          });
          return changed ? next : prevNodes;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, setNodes]);

  return workerRef.current;
}
