import type { Edge, Node } from "@xyflow/react";

interface NodeData {
  type?: string;
  [key: string]: unknown;
}

export interface SemanticLayoutOptions {
  anchorId?: string;
  focusId?: string | null;
  iterations?: number;
  stiffness?: number;
  repulsion?: number;
  gravity?: number;
  respectPinned?: boolean;
  zoneRadius?: number;
  zoneStrength?: number;
}

const DEFAULTS: Required<SemanticLayoutOptions> = {
  anchorId: "singularity",
  focusId: null,
  iterations: 160,
  stiffness: 0.05,
  repulsion: 6000,
  gravity: 0.01,
  respectPinned: true,
  zoneRadius: 600,
  zoneStrength: 0.02,
};

interface Vector {
  x: number;
  y: number;
}

// Define semantic zones (directions) for different node types
const ZONE_ANGLES: Record<string, number> = {
  chat: -Math.PI / 2, // Top (12 o'clock)
  workflow: 0, // Right (3 o'clock)
  artifact: Math.PI / 2, // Bottom (6 o'clock)
  knowledge: Math.PI, // Left (9 o'clock)
  note: Math.PI, // Group with knowledge
  reminder: Math.PI / 4,
  ticket: 0, // Group with workflows
  todo: 0, // Group with workflows
};

function getZonePosition(type: string, radius: number): Vector {
  const angle = ZONE_ANGLES[type] ?? Math.PI / 4; // Default to bottom-right
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function layoutSemantic<T extends NodeData>(
  nodes: Node<T>[],
  edges: Edge[],
  options: SemanticLayoutOptions = {}
): Node<T>[] {
  if (nodes.length <= 1) {
    return nodes;
  }

  const config = { ...DEFAULTS, ...options };
  // If a node is focused, it becomes the anchor (center of the universe)
  const effectiveAnchorId = config.focusId ?? config.anchorId;

  const positioned = nodes.map((node, index) => {
    // Keep existing positions if valid, otherwise disperse
    if (node.position?.x && node.position?.y) {
      return { ...node };
    }
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    return {
      ...node,
      position: {
        x: Math.cos(angle) * (400 + (index % 5) * 20),
        y: Math.sin(angle) * (400 + (index % 5) * 20),
      },
    };
  });

  const velocities = new Map<string, Vector>();
  const movable = new Set<string>(
    positioned
      .filter((node) => {
        // Anchor is never movable
        if (node.id === effectiveAnchorId) {
          return false;
        }
        return config.respectPinned ? node.draggable !== false : true;
      })
      .map((node) => node.id)
  );

  const idealLength = config.focusId ? 250 : 320; // Pull tighter when focused
  const damping = 0.85;

  // Pre-calculate edge connections for faster lookup
  const connectedNodes = new Set<string>();
  if (config.focusId) {
    edges.forEach((e) => {
      if (e.source === config.focusId) {
        connectedNodes.add(e.target);
      }
      if (e.target === config.focusId) {
        connectedNodes.add(e.source);
      }
    });
  }

  for (let iter = 0; iter < config.iterations; iter++) {
    // 1. Repulsive forces (Nodes push each other away)
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i];
        const b = positioned[j];

        if (!(a && b)) {
          continue;
        }

        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const distanceSq = Math.max(dx * dx + dy * dy, 100); // Avoid div by zero

        // Focused mode: Push unrelated nodes further away
        let { repulsion } = config;
        if (config.focusId) {
          // If neither is focused or connected to focus, push harder
          const aRel = a.id === config.focusId || connectedNodes.has(a.id);
          const bRel = b.id === config.focusId || connectedNodes.has(b.id);
          if (!(aRel || bRel)) {
            repulsion *= 2;
          }
        }

        const force = repulsion / distanceSq;
        const fx = (dx / Math.sqrt(distanceSq)) * force;
        const fy = (dy / Math.sqrt(distanceSq)) * force;

        if (movable.has(a.id)) {
          accumulateVelocity(velocities, a.id, fx, fy);
        }
        if (movable.has(b.id)) {
          accumulateVelocity(velocities, b.id, -fx, -fy);
        }
      }
    }

    // 2. Attractive forces (Edges pull connected nodes together)
    for (const edge of edges) {
      const source = positioned.find((node) => node.id === edge.source);
      const target = positioned.find((node) => node.id === edge.target);
      if (!(source && target)) {
        continue;
      }

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

      // Hooke's Law: F = k * (x - x0)
      // If focused, pull connected nodes TIGHTER (shorter ideal length)
      let currentIdeal = idealLength;
      let currentStiffness = config.stiffness;

      if (
        config.focusId &&
        (source.id === config.focusId || target.id === config.focusId)
      ) {
        currentIdeal = 180;
        currentStiffness = 0.08;
      }

      const force = currentStiffness * (distance - currentIdeal);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      if (movable.has(source.id)) {
        accumulateVelocity(velocities, source.id, fx, fy);
      }
      if (movable.has(target.id)) {
        accumulateVelocity(velocities, target.id, -fx, -fy);
      }
    }

    // 3. Semantic Gravity (Pull towards Zone Center)
    // Only apply if NOT focused (Focus overrides semantic zones)
    if (!config.focusId) {
      for (const node of positioned) {
        if (!movable.has(node.id)) {
          continue;
        }
        const type = node.type || "artifact";
        const zonePos = getZonePosition(type, config.zoneRadius);

        const dx = zonePos.x - node.position.x;
        const dy = zonePos.y - node.position.y;

        // Weak pull towards zone
        accumulateVelocity(
          velocities,
          node.id,
          dx * config.zoneStrength,
          dy * config.zoneStrength
        );
      }
    }

    // 4. Central Gravity (Keep everything vaguely centered)
    for (const node of positioned) {
      if (!movable.has(node.id)) {
        continue;
      }
      // If focused, gravity pulls towards the focus node (which is at 0,0)
      const gx = -node.position.x * config.gravity;
      const gy = -node.position.y * config.gravity;
      accumulateVelocity(velocities, node.id, gx, gy);
    }

    // Apply velocities
    for (const node of positioned) {
      const velocity = velocities.get(node.id);
      if (!(velocity && movable.has(node.id))) {
        continue;
      }

      node.position.x += velocity.x;
      node.position.y += velocity.y;

      velocity.x *= damping;
      velocity.y *= damping;
    }
  }

  // Final pass: Ensure anchor is at 0,0
  const anchored = positioned.map((node) => {
    if (node.id === effectiveAnchorId) {
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
