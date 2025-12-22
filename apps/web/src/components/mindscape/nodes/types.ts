import type { Node, Edge, NodeProps, EdgeProps } from "@xyflow/react";
import type { ArtifactData } from "@/store/mindscape";

/**
 * React Flow 12 Generics for Mindscape
 *
 * Note: React Flow's Node type has `type?: string`, so we can't enforce
 * the type field at the type level. Runtime validation is done via schemas.
 */

export type ArtifactNode = Node<ArtifactData>;

// For now edges don't have custom data, but we define it for future-proofing
export type ArtifactEdgeData = {
  kind?: string;
  fromDbId?: string;
  toDbId?: string;
};

export type ArtifactEdge = Edge<ArtifactEdgeData>;

/**
 * Props types for custom node and edge components
 */
export type MindscapeNodeProps = NodeProps<ArtifactNode>;
export type MindscapeEdgeProps = EdgeProps<ArtifactEdge>;
