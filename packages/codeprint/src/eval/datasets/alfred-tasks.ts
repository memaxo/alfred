import type { EvalDataset } from "../types.js";

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
        "packages/rerank/src/client.ts",
        "packages/rerank/src/cohere.ts",
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
        "packages/db/src/index.ts",
        "packages/db/scripts/migrate.ts",
        "packages/db/src/schema/review.ts",
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
        "packages/agent/src/orchestrator/tool/codex/index.ts",
      ],
      description: "Find agent tool execution code",
    },
    {
      id: "voice-assistant",
      query: "voice assistant speech recognition transcription",
      relevantFiles: [
        "packages/api/src/voice/assistant.ts",
        "packages/voice/src/session.ts",
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
        "packages/cognitive/src/transition.ts",
        "packages/cognitive/src/state/reconstruct.ts",
        "packages/runtime/src/loops/cognitive.ts",
      ],
      description: "Find cognitive state management",
    },
    {
      id: "logger-impl",
      query: "logger structured logging winston pino",
      relevantFiles: [
        "packages/logger/src/index.ts",
        "packages/logger/src/env.ts",
        "packages/logger/src/transport.ts",
      ],
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
        "packages/agent/src/environment/agentfs.ts",
        "packages/agent/src/agentfs/wrapper.ts",
        "packages/agent/src/orchestrator/tool/docker.ts",
      ],
      description: "Find AgentFS workspace management",
    },
    {
      id: "embedding-model",
      query: "embedding vector model KaLM text similarity",
      relevantFiles: [
        "packages/embed/src/index.ts",
        "packages/embed/src/process.ts",
        "packages/embed/src/providers/kalm.ts",
      ],
      description: "Find embedding model implementation",
    },
    // Semantic-focused test cases
    {
      id: "semantic-auth-functions",
      query: "login verify authenticate token functions",
      relevantFiles: [
        "packages/auth/src/token.ts",
        "packages/auth/src/index.ts",
      ],
      description: "Find files that EXPORT auth-related functions",
    },
    {
      id: "semantic-db-classes",
      query: "repository database class query",
      relevantFiles: [
        "packages/db/src/client.ts",
        "packages/db/src/repo/user.ts",
        "packages/db/src/repo/conversation.ts",
      ],
      description: "Find files with database repository helpers",
    },
    {
      id: "semantic-type-definitions",
      query: "interface type definition message event",
      relevantFiles: [
        "packages/type/src/index.ts",
        "packages/type/src/stream.ts",
        "packages/type/src/stream.zod.ts",
      ],
      description: "Find files with TypeScript interface/type definitions",
    },
    {
      id: "semantic-drizzle-dependency",
      query: "drizzle orm database schema table",
      relevantFiles: [
        "packages/db/src/client.ts",
        "packages/db/src/schema/user.ts",
        "packages/db/src/schema/workflow.ts",
      ],
      description: "Find files that depend on drizzle-orm package",
    },
    {
      id: "semantic-exported-hooks",
      query: "useChat useCompletion hook react",
      relevantFiles: [
        "apps/web/src/hooks/use-chat-logic.ts",
        "apps/native/hooks/use-chat-logic.ts",
        "apps/web/src/hooks/use-assistant-stream.ts",
      ],
      description: "Find files that export React hooks",
    },
    // BM25-focused test cases
    {
      id: "bm25-rare-symbol",
      query: "AgentFSWorkspace initialize docker container",
      relevantFiles: ["packages/agent/src/environment/agentfs.ts"],
      description: "Rare symbol should dominate common query terms",
    },
    {
      id: "bm25-checkpoint-observer",
      query: "CheckpointObserver pipeline checkpoint storage",
      relevantFiles: ["packages/pipeline/src/observers/checkpoint.ts"],
      description: "Multi-word query with a specific class name",
    },
    {
      id: "bm25-message-conversion",
      query: "convertToModelMessages pruneMessages UIMessage",
      relevantFiles: [
        "packages/history/src/history-context.ts",
        "packages/runtime/src/phases/act.ts",
      ],
      description: "Rare API name should outweigh common tokens",
    },
  ],
  description: "Real planner queries for ALFRED monorepo",
  name: "alfred-tasks",
  workspace: process.cwd().replace(/\/packages\/codeprint.*$/, ""),
};
