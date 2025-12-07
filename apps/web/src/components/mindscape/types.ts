import type { Node } from "@xyflow/react";
import type { ArtifactData } from "@/store/mindscape";

/**
 * Props for Mindscape custom node components.
 * ReactFlow v11+ NodeProps<T> expects T to extend Node, not just the data type.
 * This utility type provides the props that custom node components actually use.
 */
export type MindscapeNodeProps<TData = ArtifactData> = {
  id: string;
  data: TData;
  selected?: boolean;
};

/**
 * Type alias for Node with ArtifactData.
 * Use this for useReactFlow and other hooks that expect full Node types.
 */
export type MindscapeNode = Node<ArtifactData>;
