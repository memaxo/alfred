/**
 * Node Render System
 *
 * Renders satellite nodes as circular neurons with SDF-based glow effects.
 */

import { StorageBuffer, UniformBuffer } from "../buffer";
// Import shader source
import nodeShaderSource from "../shaders/nodes.wgsl?raw";
import type { NodeData, RenderSystem } from "../types";

/** Node buffer stride (must match WGSL struct) */
const NODE_STRIDE = 32; // 2 floats pos + 1 radius + 1 activity + 3 color + 1 type = 8 floats = 32 bytes

/** Node type enum */
export enum NodeType {
  Memory = 0,
  Action = 1,
  Insight = 2,
  Artifact = 3,
  System = 4,
}

/** Node type to color mapping */
export const NODE_TYPE_COLORS: Record<
  NodeType,
  { r: number; g: number; b: number }
> = {
  [NodeType.Memory]: { r: 0.0, g: 0.9, b: 0.8 }, // Teal
  [NodeType.Action]: { r: 1.0, g: 0.6, b: 0.2 }, // Amber
  [NodeType.Insight]: { r: 0.8, g: 0.6, b: 1.0 }, // Purple
  [NodeType.Artifact]: { r: 0.4, g: 0.8, b: 1.0 }, // Light blue
  [NodeType.System]: { r: 0.6, g: 0.6, b: 0.6 }, // Gray
};

/**
 * Node Render System
 */
export class NodeSystem implements RenderSystem {
  readonly name = "nodes";

  private device: GPUDevice | null = null;

  private nodeBuffer: StorageBuffer | null = null;
  private uniformBuffer: UniformBuffer | null = null;

  private renderPipeline: GPURenderPipeline | null = null;
  private focusedPipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;

  private nodes: NodeData[] = [];
  private maxNodes: number;
  private focusedNodeId: string | null = null;

  constructor(maxNodes = 200) {
    this.maxNodes = maxNodes;
  }

  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    // Create shader module
    const shaderModule = device.createShaderModule({
      label: "node_shader",
      code: nodeShaderSource,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      if (message.type === "error") {
        console.error("Node shader error:", message.message);
      }
    }

    // Create uniform buffer
    this.uniformBuffer = new UniformBuffer(device, 16, "node_uniforms");

    // Create node storage buffer
    this.nodeBuffer = new StorageBuffer(
      device,
      this.maxNodes * NODE_STRIDE,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      "node_buffer"
    );

    // Create render pipeline
    this.renderPipeline = device.createRenderPipeline({
      label: "node_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_node",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_node",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    // Create focused node pipeline (with expanding ring)
    this.focusedPipeline = device.createRenderPipeline({
      label: "node_focused_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_node",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_node_focused",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this.createBindGroup();
  }

  private createBindGroup(): void {
    if (
      !(
        this.device &&
        this.renderPipeline &&
        this.uniformBuffer &&
        this.nodeBuffer
      )
    ) {
      return;
    }

    const layout = this.renderPipeline.getBindGroupLayout(0);

    this.bindGroup = this.device.createBindGroup({
      label: "node_bg",
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
        { binding: 1, resource: { buffer: this.nodeBuffer.gpuBuffer } },
      ],
    });
  }

  /** Set nodes to render */
  setNodes(nodes: NodeData[]): void {
    this.nodes = nodes;
    this.uploadNodes();
  }

  /** Set focused node */
  setFocusedNode(nodeId: string | null): void {
    this.focusedNodeId = nodeId;
    // Update activity for all nodes
    for (const node of this.nodes) {
      node.activity = node.id === nodeId ? 1 : 0;
    }
    this.uploadNodes();
  }

  private uploadNodes(): void {
    if (!(this.device && this.nodeBuffer)) return;

    const data = new Float32Array(this.maxNodes * 8);

    for (let i = 0; i < Math.min(this.nodes.length, this.maxNodes); i++) {
      const node = this.nodes[i];
      const offset = i * 8;

      data[offset + 0] = node.position.x;
      data[offset + 1] = node.position.y;
      data[offset + 2] = node.radius;
      data[offset + 3] = node.activity;
      data[offset + 4] = node.color.r;
      data[offset + 5] = node.color.g;
      data[offset + 6] = node.color.b;
      data[offset + 7] = this.getNodeTypeIndex(node.type);
    }

    this.nodeBuffer.upload(data.buffer, this.nodes.length);
  }

  private getNodeTypeIndex(type: string): number {
    switch (type) {
      case "memory":
        return NodeType.Memory;
      case "action":
        return NodeType.Action;
      case "insight":
        return NodeType.Insight;
      case "artifact":
        return NodeType.Artifact;
      case "system":
        return NodeType.System;
      default:
        return NodeType.Memory;
    }
  }

  update(dt: number, uniforms: Float32Array): void {
    if (!this.uniformBuffer) return;

    for (let i = 0; i < Math.min(uniforms.length, 16); i++) {
      this.uniformBuffer.setFloat(i, uniforms[i]);
    }
    this.uniformBuffer.upload();
  }

  render(encoder: GPUCommandEncoder, target: GPUTextureView): void {
    // Rendering handled by main engine pass
  }

  /** Get node count */
  getNodeCount(): number {
    return this.nodes.length;
  }

  /** Get render pipeline */
  getRenderPipeline(): GPURenderPipeline | null {
    return this.renderPipeline;
  }

  /** Get bind group */
  getBindGroup(): GPUBindGroup | null {
    return this.bindGroup;
  }

  destroy(): void {
    this.nodeBuffer?.destroy();
    this.uniformBuffer?.destroy();
  }
}

/**
 * Get default color for node type
 */
export function getNodeTypeColor(type: string): {
  r: number;
  g: number;
  b: number;
} {
  switch (type) {
    case "memory":
      return NODE_TYPE_COLORS[NodeType.Memory];
    case "action":
      return NODE_TYPE_COLORS[NodeType.Action];
    case "insight":
      return NODE_TYPE_COLORS[NodeType.Insight];
    case "artifact":
      return NODE_TYPE_COLORS[NodeType.Artifact];
    case "system":
      return NODE_TYPE_COLORS[NodeType.System];
    default:
      return NODE_TYPE_COLORS[NodeType.Memory];
  }
}
