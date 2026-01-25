/**
 * Graph Type Definitions - Shared types for all ReactFlow-based visualizations
 *
 * This file contains type definitions for all graph visualizations in ALFRED.
 * These types are used in the isolated `components/graphs/` directory.
 *
 * @see docs/execplans/desktop-type-migration.md Section 2.5
 */

import type { Edge, Node } from "@xyflow/react";

import type { EdgeData } from "@/store/desktop/types.new";

// ─────────────────────────────────────────────────────────────────────────────
// BASE TYPES — Generic graph node/edge wrappers
// ─────────────────────────────────────────────────────────────────────────────

export type GraphNodeBase<T extends Record<string, unknown>> = Node<T>;
export type GraphEdgeBase<T extends Record<string, unknown>> = Edge<T>;

// ─────────────────────────────────────────────────────────────────────────────
// MINDSCAPE — Infinite canvas for knowledge exploration
// ─────────────────────────────────────────────────────────────────────────────

export interface MindscapeNodeData extends Record<string, unknown> {
  entityId: string;
  entityType: string;
  label: string;
  confidence?: number;
  archived?: boolean;
  description?: string;
  hgHash?: string;
}

export type MindscapeNode = Node<MindscapeNodeData>;
export type MindscapeEdge = Edge<EdgeData>;

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE GRAPH — Entity and fact visualization
// ─────────────────────────────────────────────────────────────────────────────

export type KnowledgeEntityType =
  | "person"
  | "place"
  | "concept"
  | "event"
  | "fact"
  | "relation";

export interface KnowledgeNodeData extends Record<string, unknown> {
  entityId: string;
  entityType: KnowledgeEntityType;
  label: string;
  confidence: number;
  facts?: string[];
  createdAt: string;
}

export type KnowledgeGraphNode = GraphNodeBase<KnowledgeNodeData>;
export type KnowledgeGraphEdge = GraphEdgeBase<EdgeData>;

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW DAG — Workflow builder visualization
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowNodeType =
  | "trigger"
  | "action"
  | "condition"
  | "loop"
  | "end";

export type WorkflowNodeStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowNodeData extends Record<string, unknown> {
  nodeType: WorkflowNodeType;
  label: string;
  config: Record<string, unknown>;
  status?: WorkflowNodeStatus;
}

export interface WorkflowEdgeData extends Record<string, unknown> {
  condition?: string;
}

export type WorkflowGraphNode = GraphNodeBase<WorkflowNodeData>;
export type WorkflowGraphEdge = GraphEdgeBase<WorkflowEdgeData>;

// ─────────────────────────────────────────────────────────────────────────────
// AGENT SPAWN TREE — Agent hierarchy visualization
// ─────────────────────────────────────────────────────────────────────────────

export type AgentType = "codex" | "droid" | "claude" | "roo";

export type SpawnNodeStatus = "spawning" | "running" | "completed" | "failed";

export interface SpawnNodeData extends Record<string, unknown> {
  agentId: string;
  agentType: AgentType;
  subtaskId: string;
  status: SpawnNodeStatus;
  waveIndex: number;
  label?: string;
}

export type SpawnDependencyType = "spawned_by" | "depends_on";

export interface SpawnEdgeData extends Record<string, unknown> {
  dependencyType: SpawnDependencyType;
}

export type SpawnTreeNode = GraphNodeBase<SpawnNodeData>;
export type SpawnTreeEdge = GraphEdgeBase<SpawnEdgeData>;

// ─────────────────────────────────────────────────────────────────────────────
// PLAN DAG — Plan dependency visualization
// ─────────────────────────────────────────────────────────────────────────────

export type PlanTaskType = "code" | "research" | "review" | "deploy" | "test";

export type PlanTaskStatus = "pending" | "in_progress" | "completed";

export interface PlanNodeData extends Record<string, unknown> {
  taskId: string;
  title: string;
  type: PlanTaskType;
  assignee?: string;
  status: PlanTaskStatus;
}

export type PlanDependencyType = "blocks" | "requires";

export interface PlanEdgeData extends Record<string, unknown> {
  dependencyType: PlanDependencyType;
}

export type PlanGraphNode = GraphNodeBase<PlanNodeData>;
export type PlanGraphEdge = GraphEdgeBase<PlanEdgeData>;

// ─────────────────────────────────────────────────────────────────────────────
// RAG EMBEDDING PROJECTION — Embedding space visualization
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingPointData extends Record<string, unknown> {
  chunkId: string;
  label: string;
  cluster?: number;
  score?: number;
  documentId?: string;
  content?: string;
}

export type EmbeddingNode = GraphNodeBase<EmbeddingPointData>;
// No edges for embedding visualization (points in space)

// ─────────────────────────────────────────────────────────────────────────────
// SHARED NODE TYPES — For ReactFlow nodeTypes registry
// ─────────────────────────────────────────────────────────────────────────────

export type GraphType =
  | "mindscape"
  | "knowledge"
  | "workflow"
  | "agents"
  | "plan"
  | "rag";

// Union of all graph node data types
export type AnyGraphNodeData =
  | MindscapeNodeData
  | KnowledgeNodeData
  | WorkflowNodeData
  | SpawnNodeData
  | PlanNodeData
  | EmbeddingPointData;

// Union of all graph edge data types
export type AnyGraphEdgeData =
  | EdgeData
  | WorkflowEdgeData
  | SpawnEdgeData
  | PlanEdgeData;
