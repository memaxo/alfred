/**
 * Cortex Bridge
 *
 * Synchronization layer between xyflow (React Flow) state and Cortex GPU buffers.
 * Converts React Flow nodes/edges to GPU-compatible data structures.
 */

import type {
  CortexEngine,
  EdgeData,
  NodeData,
  OrbConfig,
  OrbState,
  Vec2,
} from "@alfred/cortex";
import { getNodeTypeColor } from "@alfred/cortex/systems/nodes";
import type { Edge, Node } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";

/** Node type to Cortex node type mapping */
const NODE_TYPE_MAP: Record<string, string> = {
  chat: "action",
  workflow: "action",
  terminal: "action",
  droid: "action",
  note: "memory",
  reminder: "memory",
  timer: "memory",
  bookmark: "memory",
  todo: "memory",
  knowledge: "insight",
  concept: "insight",
  artifact: "artifact",
  ticket: "action",
  code: "artifact",
  settings: "system",
  privacy: "system",
  profile: "system",
  integrations: "system",
  workflowlist: "system",
  deployment: "system",
  orb: "system",
};

/** Default node radius by type */
const NODE_RADIUS_MAP: Record<string, number> = {
  orb: 150,
  chat: 40,
  workflow: 35,
  knowledge: 30,
  concept: 25,
  note: 30,
  reminder: 25,
  timer: 25,
  terminal: 35,
  artifact: 30,
  default: 28,
};

/**
 * Convert xyflow node to Cortex NodeData
 */
export function xyflowNodeToCortex(
  node: Node<ArtifactData>,
  focusedNodeId: string | null
): NodeData {
  const nodeType = node.type ?? "default";
  const cortexType = NODE_TYPE_MAP[nodeType] ?? "memory";
  const color = getNodeTypeColor(cortexType);
  const radius = NODE_RADIUS_MAP[nodeType] ?? NODE_RADIUS_MAP.default ?? 30;

  return {
    id: node.id,
    position: {
      x: node.position.x + (node.width ?? 60) / 2,
      y: node.position.y + (node.height ?? 60) / 2,
    },
    radius,
    activity: node.id === focusedNodeId ? 1 : 0,
    color: { ...color, a: 1 },
    type: cortexType,
  };
}

/**
 * Convert xyflow edge to Cortex EdgeData
 */
export function xyflowEdgeToCortex(
  edge: Edge,
  nodes: Node<ArtifactData>[],
  activeEdges: Set<string>,
  orbCenter: Vec2
): EdgeData | null {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  const sourcePos: Vec2 = {
    x: sourceNode.position.x + (sourceNode.width ?? 60) / 2,
    y: sourceNode.position.y + (sourceNode.height ?? 60) / 2,
  };
  const targetPos: Vec2 = {
    x: targetNode.position.x + (targetNode.width ?? 60) / 2,
    y: targetNode.position.y + (targetNode.height ?? 60) / 2,
  };

  // Control points curve toward orb center
  const midX = (sourcePos.x + targetPos.x) / 2;
  const midY = (sourcePos.y + targetPos.y) / 2;
  const toOrbX = orbCenter.x - midX;
  const toOrbY = orbCenter.y - midY;
  const curvature = 0.3;

  return {
    id: edge.id,
    p0: sourcePos,
    p1: {
      x: sourcePos.x + toOrbX * curvature,
      y: sourcePos.y + toOrbY * curvature,
    },
    p2: {
      x: targetPos.x + toOrbX * curvature,
      y: targetPos.y + toOrbY * curvature,
    },
    p3: targetPos,
    active: activeEdges.has(edge.id) ? 1 : 0,
    color: { r: 0, g: 0.9, b: 0.8, a: 1 }, // Teal
  };
}

/**
 * Get orb node position from xyflow state
 */
export function getOrbCenter(nodes: Node<ArtifactData>[]): Vec2 {
  const orbNode = nodes.find((n) => n.type === "orb");
  if (orbNode) {
    return {
      x: orbNode.position.x + (orbNode.width ?? 300) / 2,
      y: orbNode.position.y + (orbNode.height ?? 300) / 2,
    };
  }
  // Default to center of viewport
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/**
 * Cortex Bridge Hook
 *
 * Synchronizes Mindscape store state with Cortex engine GPU buffers.
 */
export function useCortexBridge(engine: CortexEngine | null) {
  const nodes = useMindscapeStore((state) => state.nodes);
  const edges = useMindscapeStore((state) => state.edges);
  const focusedNodeId = useMindscapeStore((state) => state.focusedNodeId);
  const activeEdges = useMindscapeStore((state) => state.activeEdges);

  const prevNodesRef = useRef<Node<ArtifactData>[]>([]);
  const prevEdgesRef = useRef<Edge[]>([]);
  const prevFocusedRef = useRef<string | null>(null);

  // Compute orb center
  const orbCenter = useMemo(() => getOrbCenter(nodes), [nodes]);

  // Sync nodes to GPU
  useEffect(() => {
    if (!engine) {
      return;
    }

    // Check if nodes actually changed (shallow comparison)
    const nodesChanged =
      nodes !== prevNodesRef.current ||
      focusedNodeId !== prevFocusedRef.current;

    if (!nodesChanged) {
      return;
    }

    prevNodesRef.current = nodes;
    prevFocusedRef.current = focusedNodeId;

    // Convert nodes (exclude orb - it's rendered separately)
    const cortexNodes = nodes
      .filter((n) => n.type !== "orb")
      .map((n) => xyflowNodeToCortex(n, focusedNodeId));

    // Update node system
    const nodeSystem =
      engine.getSystem<import("@alfred/cortex/systems/nodes").NodeSystem>(
        "nodes"
      );
    if (nodeSystem) {
      nodeSystem.setNodes(cortexNodes);
      nodeSystem.setFocusedNode(focusedNodeId);
    }

    // Update orb center
    engine.setUniforms({ orbCenter });
  }, [engine, nodes, focusedNodeId, orbCenter]);

  // Sync edges to GPU
  useEffect(() => {
    if (!engine) {
      return;
    }

    // Check if edges actually changed
    const edgesChanged = edges !== prevEdgesRef.current;
    if (!edgesChanged) {
      return;
    }

    prevEdgesRef.current = edges;

    // Convert edges
    const cortexEdges = edges
      .map((e) => xyflowEdgeToCortex(e, nodes, activeEdges, orbCenter))
      .filter((e): e is EdgeData => e !== null);

    // Update edge system
    const edgeSystem =
      engine.getSystem<import("@alfred/cortex/systems/edges").EdgeSystem>(
        "edges"
      );
    if (edgeSystem) {
      edgeSystem.setEdges(cortexEdges);
      edgeSystem.setOrbCenter(orbCenter);
    }
  }, [engine, edges, nodes, activeEdges, orbCenter]);

  // Sync active edges (for animation)
  useEffect(() => {
    if (!engine) {
      return;
    }

    const edgeSystem =
      engine.getSystem<import("@alfred/cortex/systems/edges").EdgeSystem>(
        "edges"
      );
    if (edgeSystem) {
      // Recompute edges with updated activity
      const cortexEdges = edges
        .map((e) => xyflowEdgeToCortex(e, nodes, activeEdges, orbCenter))
        .filter((e): e is EdgeData => e !== null);
      edgeSystem.setEdges(cortexEdges);
    }
  }, [engine, activeEdges, edges, nodes, orbCenter]);

  return { orbCenter };
}

/**
 * Cortex Orb State Hook
 *
 * Maps cognitive/agent state to orb visual configuration.
 */
export function useCortexOrbState(
  engine: CortexEngine | null,
  agentState: "idle" | "listening" | "thinking" | "speaking" = "idle",
  audioLevels: { low: number; mid: number } = { low: 0, mid: 0 }
) {
  const nodes = useMindscapeStore((state) => state.nodes);
  const orbCenter = useMemo(() => getOrbCenter(nodes), [nodes]);

  // Map agent state to orb state
  const orbState: OrbState = useMemo(() => {
    switch (agentState) {
      case "listening":
        return "listening";
      case "thinking":
        return "processing";
      case "speaking":
        return "active";
      default:
        return "idle";
    }
  }, [agentState]);

  // Update engine orb config
  useEffect(() => {
    if (!engine) {
      return;
    }

    const config: OrbConfig = {
      center: orbCenter,
      innerRadius: 150,
      outerRadius: 400,
      state: orbState,
      fiberCount: 2000,
      segmentsPerFiber: 50,
      rotationSpeed: Math.PI / 30, // 60s per rotation
    };

    engine.setOrbConfig(config);
    engine.setAudioLevels(audioLevels.low, audioLevels.mid);
  }, [engine, orbCenter, orbState, audioLevels]);

  return { orbCenter, orbState };
}

/**
 * Cortex LOD Hook
 *
 * Adjusts rendering quality based on zoom level.
 */
export function useCortexLOD(engine: CortexEngine | null, zoom: number) {
  useEffect(() => {
    if (!engine) {
      return;
    }

    // Update camera zoom
    engine.setCamera({ zoom });

    // LOD manager automatically adjusts particle/fiber counts
    const lod = engine.getLODManager().getLOD();

    // Update particle system
    const particleSystem =
      engine.getSystem<
        import("@alfred/cortex/systems/particles").ParticleSystem
      >("particles");
    if (particleSystem) {
      particleSystem.setParticleCount(lod.particles);
    }

    // Update corona system
    const coronaSystem =
      engine.getSystem<import("@alfred/cortex/systems/corona").CoronaSystem>(
        "corona"
      );
    if (coronaSystem) {
      coronaSystem.setFiberCount(lod.fibers);
    }
  }, [engine, zoom]);
}

/**
 * Batch update helper for performance
 */
export function batchCortexUpdate(
  engine: CortexEngine,
  updates: {
    nodes?: NodeData[];
    edges?: EdgeData[];
    orbConfig?: OrbConfig;
    audioLevels?: { low: number; mid: number };
  }
) {
  if (updates.nodes) {
    const nodeSystem =
      engine.getSystem<import("@alfred/cortex/systems/nodes").NodeSystem>(
        "nodes"
      );
    nodeSystem?.setNodes(updates.nodes);
  }

  if (updates.edges) {
    const edgeSystem =
      engine.getSystem<import("@alfred/cortex/systems/edges").EdgeSystem>(
        "edges"
      );
    edgeSystem?.setEdges(updates.edges);
  }

  if (updates.orbConfig) {
    engine.setOrbConfig(updates.orbConfig);
  }

  if (updates.audioLevels) {
    engine.setAudioLevels(updates.audioLevels.low, updates.audioLevels.mid);
  }
}
