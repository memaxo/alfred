import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { toolDroid } from "./tool/droid";
import { toolGit } from "./tool/git";
import { toolRouter } from "./tool/router";
import { toolTicket } from "./tool/ticket";
import { toolDocker } from "./tool/docker";
import { toolWeb } from "./tool/web";
import { buildAgentScorers } from "../eval/scorer";

function createMemory(store?: PostgresStore) {
  if (!store) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return undefined;
    }
    store = new PostgresStore({
      connectionString,
    });
  }

  if (!store) {
    return undefined;
  }

  return new Memory({
    storage: store,
    options: {
      lastMessages: 10,
      workingMemory: {
        enabled: true,
        scope: "resource",
      },
      semanticRecall: {
        topK: 3,
        messageRange: 2,
        scope: "resource",
      },
    },
  });
}

export function buildOrchestratorAgent(store?: PostgresStore) {
  const rate = Number(process.env.EVALS_SAMPLING_RATE ?? "0.1");
  const samplingRate = Number.isFinite(rate) ? rate : undefined;
  const scorers = buildAgentScorers({
    agent: "orchestrator",
    samplingRate,
  });

  return new Agent({
    name: "orchestrator",
    instructions: [
      {
        role: "system",
        content:
          "You coordinate secure software engineering tasks. Prefer read or low autonomy unless the caller is elevated. Stream concise updates for each stage, manage git branches/worktrees safely, update routers, and keep Linear tickets in sync.",
      },
    ],
    model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini",
    tools: {
      droid: toolDroid,
      git: toolGit,
      router: toolRouter,
      docker: toolDocker,
      ticket: toolTicket,
      web: toolWeb,
    },
    memory: createMemory(store),
    ...(Object.keys(scorers).length > 0
      ? {
          scorers,
        }
      : {}),
  });
}
