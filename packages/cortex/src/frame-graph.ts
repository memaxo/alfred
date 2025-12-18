/**
 * Frame Graph
 *
 * Dependency graph for render pass ordering.
 * Ensures correct execution order and resource transitions.
 */

import type { FrameGraphNode } from "./types";

/**
 * Frame graph for render pass management
 */
export class FrameGraph {
  private readonly nodes: Map<string, FrameGraphNode> = new Map();
  private executionOrder: string[] = [];
  private dirty = true;

  /**
   * Add a render pass node
   */
  addNode(node: FrameGraphNode): void {
    this.nodes.set(node.name, node);
    this.dirty = true;
  }

  /**
   * Remove a render pass node
   */
  removeNode(name: string): void {
    this.nodes.delete(name);
    this.dirty = true;
  }

  /**
   * Topologically sort nodes based on dependencies
   */
  private compile(): void {
    if (!this.dirty) {
      return;
    }

    // Build adjacency list
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const node of this.nodes.values()) {
      if (!graph.has(node.name)) {
        graph.set(node.name, new Set());
        inDegree.set(node.name, 0);
      }

      // Find nodes that produce our inputs
      for (const input of node.inputs) {
        for (const other of this.nodes.values()) {
          if (other.outputs.includes(input)) {
            graph.get(other.name)?.add(node.name);
            inDegree.set(node.name, (inDegree.get(node.name) ?? 0) + 1);
          }
        }
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: string[] = [];

    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const name = queue.shift()!;
      result.push(name);

      for (const dependent of graph.get(name) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    if (result.length !== this.nodes.size) {
      throw new Error("Cyclic dependency detected in frame graph");
    }

    this.executionOrder = result;
    this.dirty = false;
  }

  /**
   * Execute all render passes in dependency order
   */
  execute(encoder: GPUCommandEncoder): void {
    this.compile();

    for (const name of this.executionOrder) {
      const node = this.nodes.get(name);
      if (node) {
        node.execute(encoder);
      }
    }
  }

  /**
   * Get execution order (for debugging)
   */
  getExecutionOrder(): string[] {
    this.compile();
    return [...this.executionOrder];
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.nodes.clear();
    this.executionOrder = [];
    this.dirty = true;
  }
}

/**
 * Create a frame graph node
 */
export function createFrameGraphNode(
  name: string,
  inputs: string[],
  outputs: string[],
  execute: (encoder: GPUCommandEncoder) => void
): FrameGraphNode {
  return { name, inputs, outputs, execute };
}

/**
 * Standard render pass names
 */
export const PASS_NAMES = {
  PARTICLE_COMPUTE: "particle_compute",
  CORONA_COMPUTE: "corona_compute",
  EDGE_COMPUTE: "edge_compute",
  ATMOSPHERE: "atmosphere",
  NODES: "nodes",
  EDGES: "edges",
  CORONA: "corona",
  PARTICLES: "particles",
  BLOOM_EXTRACT: "bloom_extract",
  BLOOM_BLUR_H: "bloom_blur_h",
  BLOOM_BLUR_V: "bloom_blur_v",
  COMPOSITE: "composite",
} as const;

/**
 * Build standard frame graph for Cortex rendering
 */
export function buildStandardFrameGraph(): FrameGraph {
  const graph = new FrameGraph();

  // Compute passes (no render output, just buffer updates)
  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.PARTICLE_COMPUTE,
      [],
      ["particle_buffer"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.CORONA_COMPUTE,
      [],
      ["corona_buffer"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(PASS_NAMES.EDGE_COMPUTE, [], ["edge_buffer"], () => {})
  );

  // Render passes
  graph.addNode(
    createFrameGraphNode(PASS_NAMES.ATMOSPHERE, [], ["scene_color"], () => {})
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.NODES,
      ["scene_color"],
      ["scene_color"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.EDGES,
      ["scene_color", "edge_buffer"],
      ["scene_color"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.CORONA,
      ["scene_color", "corona_buffer"],
      ["scene_color"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.PARTICLES,
      ["scene_color", "particle_buffer"],
      ["scene_color"],
      () => {}
    )
  );

  // Post-processing
  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.BLOOM_EXTRACT,
      ["scene_color"],
      ["bloom_bright"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.BLOOM_BLUR_H,
      ["bloom_bright"],
      ["bloom_blur_h"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.BLOOM_BLUR_V,
      ["bloom_blur_h"],
      ["bloom_blur_v"],
      () => {}
    )
  );

  graph.addNode(
    createFrameGraphNode(
      PASS_NAMES.COMPOSITE,
      ["scene_color", "bloom_blur_v"],
      ["final"],
      () => {}
    )
  );

  return graph;
}
