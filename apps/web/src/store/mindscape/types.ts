import type { SearchReceipt } from "@alfred/type";
import type {
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from "@xyflow/react";
import type { ArtifactNode, ArtifactEdge } from "@/components/mindscape/nodes/types";
import type { ArtifactData, KnowledgeNodeData } from "../mindscape.schemas";

export type CachedRagDocEntry = {
  data: KnowledgeNodeData;
  cachedAt: number;
};

export type ContextCacheEntry = {
  receipt?: SearchReceipt;
  phase?: "cache" | "scan" | "web" | "bundle";
  source?: "cache" | "handoff" | "scan";
  updatedAt: number;
};

export type FeedbackIntent = "positive" | "negative";

export type FeedbackEntry = {
  intent: FeedbackIntent;
  updatedAt: number;
};

export type MindscapeState = {
  // Graph State
  nodes: ArtifactNode[];
  edges: ArtifactEdge[];
  activeEdges: Set<string>;
  highlightedEdgeIds: Set<string>;
  focusedNodeId: string | null;
  isSpaceMode: boolean;

  // Cache State
  ragDocCache: Record<string, CachedRagDocEntry>;
  ragDocCacheStats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  // Context & Feedback
  contextCache: Record<string, ContextCacheEntry>;
  feedbackByNode: Record<string, FeedbackEntry>;

  // React Flow actions
  // Using base types to avoid variance issues with React Flow's generics
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Mindscape actions
  addArtifact: (node: ArtifactNode) => void;
  removeArtifact: (nodeId: string) => void;
  updateArtifactData: (nodeId: string, data: Partial<ArtifactData>) => void;
  focusNode: (nodeId: string | null) => void;
  setSpaceMode: (isSpaceMode: boolean) => void;
  setNodes: (
    nodes:
      | ArtifactNode[]
      | ((prev: ArtifactNode[]) => ArtifactNode[])
  ) => void;
  setEdges: (edges: ArtifactEdge[]) => void;
  setHighlightedEdges: (edgeIds: string[]) => void;
  triggerEdgeActivity: (edgeId: string, durationMs?: number) => void;
  triggerNodeActivity: (
    nodeId: string,
    type: "input" | "output" | "processing"
  ) => void;
  autoLayout: () => void;
  cacheRagDoc: (dbId: string, data: KnowledgeNodeData) => void;
  evictRagDoc: (dbId: string) => void;
  recordRagDocCacheHit: () => void;
  recordRagDocCacheMiss: () => void;
  recordContextReceipt: (
    nodeId: string,
    entry: Partial<Omit<ContextCacheEntry, "updatedAt">> & {
      receipt?: SearchReceipt;
    }
  ) => void;
  clearContextReceipt: (nodeId: string) => void;
  recordFeedback: (nodeId: string, intent: FeedbackIntent) => void;
};
