import type { SubTask, WavePlan, NodeId } from "@alfred/type/plan";

/**
 * Pattern: A learned template for workflow execution
 */
export type Pattern = {
  id: string;
  trigger: string;
  planTemplate: unknown;
  confidence: number;
};

/**
 * Phase: Groups SubTasks into PRD-like sections
 */
export type Phase = {
  id: string;
  name: string; // e.g., "Design System Extension"
  description: string;
  tasks: SubTask[];
  dependsOn: string[];
  estimatedDurationMs: number;
  agentType: "codex" | "droid" | "claude-code" | "research" | "review" | "orchestrator";
};

/**
 * StructuredPlan: The AI-generated PRD
 */
export type StructuredPlan = {
  id: string;
  title: string;
  intent: string; // Original user request
  workspace?: string; // Optional workspace path
  phases: Phase[];
  waves?: WavePlan[]; // Generated from phases
  resources: {
    agentCount: number;
    strategy: "sequential" | "parallel" | "topological" | "mixed";
    isolation: "container" | "worktree";
  };
  evaluationCriteria: Array<
    | {
        name: string;
        weight: number;
        threshold: string;
      }
    | string
  >;
};

/**
 * WorkflowPattern: Learned reusable template
 */
export type WorkflowPattern = {
  id: string;
  trigger: string; // Semantic trigger (e.g., "add-ui-feature")
  planTemplate: Omit<StructuredPlan, "id" | "intent">;
  successRate: number;
  avgDurationMs: number;
  usageCount: number;
  knowledgeNodeId?: NodeId; // Link to hypergraph for semantic queries
};

/**
 * PlanEvaluation: Best-of-N evaluation result
 */
export type PlanEvaluation = {
  planId: string;
  scores: Array<{
    judge: string; // e.g., "claude-sonnet", "gpt-4o"
    criterion: string; // e.g., "completeness", "risk"
    score: number; // 0.0 to 1.0
    reasoning: string;
  }>;
  aggregateScore: number;
  selected: boolean;
};
