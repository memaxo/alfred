// --- Types ---

export interface PhysicsNode {
  id: string;
  x: number;
  y: number;
  type: string;
  draggable?: boolean;
  isDragging?: boolean;
}

export interface PhysicsEdge {
  id: string;
  source: string;
  target: string;
}

export type WorkerMessage =
  | { type: "UPDATE_NODES"; nodes: PhysicsNode[]; edges: PhysicsEdge[] }
  | { type: "UPDATE_FOCUS"; focusId: string | null }
  | { type: "UPDATE_CONFIG"; config: Partial<PhysicsConfig> }
  | { type: "STOP" }
  | { type: "START" };

export interface PhysicsConfig {
  stiffness: number;
  repulsion: number;
  gravity: number;
  damping: number;
  zoneRadius: number;
  zoneStrength: number;
  focusId: string | null;
  dt: number; // Time step (unused in simple Verlet, but good for future)
}

// --- State ---

let nodes: Map<string, PhysicsNode> = new Map();
let edges: PhysicsEdge[] = [];
const velocities: Map<string, { x: number; y: number }> = new Map();
let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

let config: PhysicsConfig = {
  stiffness: 0.05,
  repulsion: 6000,
  gravity: 0.01,
  damping: 0.85,
  zoneRadius: 600,
  zoneStrength: 0.02,
  focusId: null,
  dt: 1 / 60,
};

// --- Semantic Zones ---
const ZONE_ANGLES: Record<string, number> = {
  chat: -Math.PI / 2,
  workflow: 0,
  artifact: Math.PI / 2,
  knowledge: Math.PI,
  note: Math.PI,
  reminder: Math.PI / 4,
  ticket: 0,
  todo: 0,
};

function getZonePosition(type: string, radius: number) {
  const angle = ZONE_ANGLES[type] ?? Math.PI / 4;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

// --- Simulation Loop ---

function tick() {
  if (!nodes.size) {
    return;
  }

  const nodesArray = [...nodes.values()];
  const positions = new Float32Array(nodesArray.length * 2); // [x, y, x, y...]

  // Pre-calc focus connections
  const connectedToFocus = new Set<string>();
  if (config.focusId) {
    edges.forEach((e) => {
      if (e.source === config.focusId) {
        connectedToFocus.add(e.target);
      }
      if (e.target === config.focusId) {
        connectedToFocus.add(e.source);
      }
    });
  }

  // 1. Repulsion
  for (let i = 0; i < nodesArray.length; i++) {
    for (let j = i + 1; j < nodesArray.length; j++) {
      const a = nodesArray[i];
      const b = nodesArray[j];
      if (!(a && b)) {
        continue;
      }
      if (a.id === config.focusId || b.id === config.focusId) {
        continue; // Don't push anchor? actually anchor stays 0,0 but can push others
      }

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = Math.max(dx * dx + dy * dy, 100);

      let { repulsion } = config;
      // Boost repulsion if focused and nodes are unrelated
      if (config.focusId) {
        const aRel = a.id === config.focusId || connectedToFocus.has(a.id);
        const bRel = b.id === config.focusId || connectedToFocus.has(b.id);
        if (!(aRel || bRel)) {
          repulsion *= 3;
        }
      }

      const force = repulsion / distSq;
      const fx = (dx / Math.sqrt(distSq)) * force;
      const fy = (dy / Math.sqrt(distSq)) * force;

      if (!isLocked(a.id)) {
        addVelocity(a.id, fx, fy);
      }
      if (!isLocked(b.id)) {
        addVelocity(b.id, -fx, -fy);
      }
    }
  }

  // 2. Attraction (Springs)
  const idealLength = config.focusId ? 180 : 320;

  for (const edge of edges) {
    const s = nodes.get(edge.source);
    const t = nodes.get(edge.target);
    if (!(s && t)) {
      continue;
    }

    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

    // Focus tightening
    let k = config.stiffness;
    let len = idealLength;
    if (
      config.focusId &&
      (s.id === config.focusId || t.id === config.focusId)
    ) {
      k = 0.08;
      len = 150;
    }

    const force = k * (dist - len);
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (!isLocked(s.id)) {
      addVelocity(s.id, fx, fy);
    }
    if (!isLocked(t.id)) {
      addVelocity(t.id, -fx, -fy);
    }
  }

  // 3. Semantic Gravity
  if (!config.focusId) {
    for (const node of nodesArray) {
      if (isLocked(node.id)) {
        continue;
      }
      const zone = getZonePosition(node.type, config.zoneRadius);
      const dx = zone.x - node.x;
      const dy = zone.y - node.y;
      addVelocity(node.id, dx * config.zoneStrength, dy * config.zoneStrength);
    }
  }

  // 4. Central Gravity
  for (const node of nodesArray) {
    if (isLocked(node.id)) {
      continue;
    }
    const gx = -node.x * config.gravity;
    const gy = -node.y * config.gravity;
    addVelocity(node.id, gx, gy);
  }

  // Apply Velocity
  for (let i = 0; i < nodesArray.length; i++) {
    const node = nodesArray[i];
    if (!node) {
      continue;
    }
    const vel = velocities.get(node.id);

    if (node.id === config.focusId) {
      // Anchor locked at 0,0
      node.x = 0;
      node.y = 0;
      positions[i * 2] = 0;
      positions[i * 2 + 1] = 0;
      if (vel) {
        vel.x = 0;
        vel.y = 0;
      }
      continue;
    }

    if (vel && !isLocked(node.id)) {
      node.x += vel.x;
      node.y += vel.y;
      vel.x *= config.damping;
      vel.y *= config.damping;

      // Stop if tiny velocity (sleep)
      if (Math.abs(vel.x) < 0.01 && Math.abs(vel.y) < 0.01) {
        vel.x = 0;
        vel.y = 0;
      }
    }

    positions[i * 2] = node.x;
    positions[i * 2 + 1] = node.y;
  }

  // Send back positions
  // We send a map of ID -> Position, or just the arrays?
  // For React Flow, we need IDs. Sending a Map or Object is easiest for now.
  // Optimization: Array of objects { id, position: {x,y} }
  const updates = nodesArray.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
  }));
  self.postMessage({ type: "TICK", nodes: updates });
}

function isLocked(id: string) {
  const node = nodes.get(id);
  return id === config.focusId || node?.isDragging;
}

function addVelocity(id: string, x: number, y: number) {
  const v = velocities.get(id);
  if (v) {
    v.x += x;
    v.y += y;
  } else {
    velocities.set(id, { x, y });
  }
}

// --- Handlers ---

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  switch (type) {
    case "UPDATE_NODES": {
      // Type assertion to access payload safely based on discriminated union
      const payload = e.data as Extract<
        WorkerMessage,
        { type: "UPDATE_NODES" }
      >;
      const { nodes: newNodes, edges: newEdges } = payload;

      // Sync nodes map (preserve positions if exist)
      const freshNodes = new Map<string, PhysicsNode>();

      newNodes.forEach((n) => {
        const existing = nodes.get(n.id);
        freshNodes.set(n.id, {
          id: n.id,
          type: n.type,
          x: existing ? existing.x : n.x || Math.random() * 100,
          y: existing ? existing.y : n.y || Math.random() * 100,
          draggable: n.draggable,
          isDragging: n.isDragging,
        });
        if (!velocities.has(n.id)) {
          velocities.set(n.id, { x: 0, y: 0 });
        }
      });

      nodes = freshNodes;
      edges = newEdges;
      break;
    }
    case "UPDATE_FOCUS": {
      const payload = e.data as Extract<
        WorkerMessage,
        { type: "UPDATE_FOCUS" }
      >;
      config.focusId = payload.focusId;
      break;
    }
    case "UPDATE_CONFIG": {
      const payload = e.data as Extract<
        WorkerMessage,
        { type: "UPDATE_CONFIG" }
      >;
      config = { ...config, ...payload.config };
      break;
    }
    case "START": {
      if (!isRunning) {
        isRunning = true;
        intervalId = setInterval(tick, 1000 / 60); // 60hz
      }
      break;
    }
    case "STOP": {
      isRunning = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      break;
    }
  }
};

// Default export for Bun test environment compatibility
// In production, Vite handles ?worker imports specially and transforms this into a Worker constructor
// In tests, this is mocked, but we provide a basic class structure for type compatibility
export default class PhysicsWorker {
  postMessage() {}
  terminate() {}
  onmessage = null;
}
