import { type EvalDataset } from "../types.js";

export const alfredTasksDataset: EvalDataset = {
  cases: [
    {
      id: "workflow-router",
      query: "workflow api router tRPC endpoint",
      relevantFiles: [
        "packages/api/src/routers/workflow.ts",
        "packages/api/src/routers/index.ts",
        "packages/api/src/trpc.ts",
      ],
      description: "Find workflow API routing code",
    },
    {
      id: "rerank-impl",
      query: "rerank cross-encoder embedding model",
      relevantFiles: [
        "packages/rerank/src/index.ts",
        "packages/rerank/src/rerank.ts",
      ],
      description: "Find reranking implementation",
    },
    {
      id: "auth-token",
      query: "authentication token JWT signing verification",
      relevantFiles: [
        "packages/auth/src/token.ts",
        "packages/auth/src/index.ts",
      ],
      description: "Find auth token handling",
    },
    {
      id: "db-migrations",
      query: "database migration drizzle schema",
      relevantFiles: [
        "packages/db/src/schema/index.ts",
        "packages/db/src/index.ts",
      ],
      description: "Find database schema definitions",
    },
    {
      id: "pipeline-stages",
      query: "pipeline stage orchestrator observer",
      relevantFiles: [
        "packages/pipeline/src/index.ts",
        "packages/pipeline/src/runner.ts",
        "packages/pipeline/src/observers/index.ts",
      ],
      description: "Find pipeline orchestration code",
    },
    {
      id: "agent-tools",
      query: "agent tool codex executor spawn",
      relevantFiles: [
        "packages/agent/src/orchestrator/tool/codex/exec.ts",
        "packages/agent/src/orchestrator/tool/index.ts",
      ],
      description: "Find agent tool execution code",
    },
    {
      id: "voice-assistant",
      query: "voice assistant speech recognition transcription",
      relevantFiles: [
        "packages/api/src/voice/assistant.ts",
        "packages/voice/src/index.ts",
      ],
      description: "Find voice assistant code",
    },
    {
      id: "metrics-prometheus",
      query: "prometheus metrics counter histogram gauge",
      relevantFiles: [
        "packages/metrics/src/registry.ts",
        "packages/metrics/src/shared.ts",
        "packages/api/src/metrics.ts",
      ],
      description: "Find metrics instrumentation",
    },
    {
      id: "cognitive-state",
      query: "cognitive state machine transition autonomy",
      relevantFiles: [
        "packages/cognitive/src/index.ts",
        "packages/cognitive/src/state.ts",
      ],
      description: "Find cognitive state management",
    },
    {
      id: "logger-impl",
      query: "logger structured logging winston pino",
      relevantFiles: ["packages/logger/src/index.ts"],
      description: "Find logging implementation",
    },
    {
      id: "web-app-routes",
      query: "tanstack start route layout page",
      relevantFiles: [
        "apps/web/src/routeTree.gen.ts",
        "apps/web/src/routes/__root.tsx",
      ],
      description: "Find web app routing",
    },
    {
      id: "native-carplay",
      query: "react native carplay controller navigation",
      relevantFiles: [
        "apps/native/lib/carplay/controller.ts",
        "apps/native/lib/carplay/index.ts",
      ],
      description: "Find CarPlay integration",
    },
    {
      id: "plan-decompose",
      query: "task decomposition planner wave dependency",
      relevantFiles: [
        "packages/plan/src/generate/decompose.ts",
        "packages/plan/src/index.ts",
      ],
      description: "Find task decomposition logic",
    },
    {
      id: "agentfs-workspace",
      query: "agentfs workspace docker container isolation",
      relevantFiles: [
        "packages/agent/src/agentfs/index.ts",
        "packages/agent/src/agentfs/wrapper.ts",
      ],
      description: "Find AgentFS workspace management",
    },
    {
      id: "embedding-model",
      query: "embedding vector model KaLM text similarity",
      relevantFiles: ["packages/embed/src/index.ts"],
      description: "Find embedding model implementation",
    },
  ],
  description: "Real planner queries for ALFRED monorepo",
  name: "alfred-tasks",
  workspace: process.cwd().replace(/\/packages\/codeprint.*$/, ""),
};
