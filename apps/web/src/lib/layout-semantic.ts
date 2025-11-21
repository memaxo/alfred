import type { Edge, Node } from "@xyflow/react";
import type { ArtifactData } from "@/store/mindscape";

export type SemanticLayoutOptions = {
  anchorId?: string;
  iterations?: number;
  stiffness?: number;
  repulsion?: number;
  gravity?: number;
  respectPinned?: boolean;
};

const DEFAULTS: Required<SemanticLayoutOptions> = {
  anchorId: "singularity",
  iterations: 160,
  stiffness: 0.05,
  repulsion: 6_000,
  gravity: 0.01,
  respectPinned: true,
};

type Vector = { x: number; y: number };

export function layoutSemantic(
  nodes: Node<ArtifactData>[],
  edges: Edge[],
  options: SemanticLayoutOptions = {}
): Node<ArtifactData>[] {
  if (nodes.length <= 1) {
    return nodes;
  }

  const config = { ...DEFAULTS, ...options };
  const anchorId = config.anchorId;

  const positioned = nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    return {
      ...node,
      position: {
        x:
          node.position?.x ??
          Math.cos(angle) * (400 + (index % 5) * 20),
        y:
          node.position?.y ??
          Math.sin(angle) * (400 + (index % 5) * 20),
      },
    };
  });

  const velocities = new Map<string, Vector>();
  const movable = new Set<string>(
    positioned
      .filter((node) =>
        config.respectPinned ? node.draggable !== false : true
      )
      .map((node) => node.id)
  );

  const idealLength = 320;
  const damping = 0.85;

  for (let iter = 0; iter < config.iterations; iter++) {
    // Repulsive forces
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i]!;
        const b = positioned[j]!;
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const distanceSq = Math.max(dx * dx + dy * dy, 0.01);
        const force = config.repulsion / distanceSq;
        const fx = (dx / Math.sqrt(distanceSq)) * force;
        const fy = (dy / Math.sqrt(distanceSq)) * force;

        if (movable.has(a.id) && a.id !== anchorId) {
          accumulateVelocity(velocities, a.id, fx, fy);
        }
        if (movable.has(b.id) && b.id !== anchorId) {
          accumulateVelocity(velocities, b.id, -fx, -fy);
        }
      }
    }

    // Attractive forces along edges
    for (const edge of edges) {
      const source = positioned.find((node) => node.id === edge.source);
      const target = positioned.find((node) => node.id === edge.target);
      if (!(source && target)) continue;
      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const force = config.stiffness * (distance - idealLength);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      if (movable.has(source.id) && source.id !== anchorId) {
        accumulateVelocity(velocities, source.id, fx, fy);
      }
      if (movable.has(target.id) && target.id !== anchorId) {
        accumulateVelocity(velocities, target.id, -fx, -fy);
      }
    }

    // Gravity toward center
    for (const node of positioned) {
      if (!movable.has(node.id) || node.id === anchorId) {
        continue;
      }
      const gx = -node.position.x * config.gravity;
      const gy = -node.position.y * config.gravity;
      accumulateVelocity(velocities, node.id, gx, gy);
    }

    // Apply velocities
    for (const node of positioned) {
      const velocity = velocities.get(node.id);
      if (!velocity || !movable.has(node.id) || node.id === anchorId) {
        continue;
      }
      node.position = {
        x: node.position.x + velocity.x,
        y: node.position.y + velocity.y,
      };
      velocity.x *= damping;
      velocity.y *= damping;
    }
  }

  const anchored = positioned.map((node) => {
    if (node.id === anchorId) {
      return {
        ...node,
        position: { x: 0, y: 0 },
      };
    }
    return node;
  });

  return anchored;
}

function accumulateVelocity(
  velocities: Map<string, Vector>,
  id: string,
  x: number,
  y: number
) {
  const existing = velocities.get(id) ?? { x: 0, y: 0 };
  existing.x += x;
  existing.y += y;
  velocities.set(id, existing);
}
