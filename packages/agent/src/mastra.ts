import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { buildOrchestratorAgent } from "./orchestrator/agent";
import { planWorkflow } from "./orchestrator/flow/plan";

const connectionString = process.env.DATABASE_URL;

export const sharedStore = connectionString
  ? new PostgresStore({
      connectionString,
    })
  : undefined;

export const orchestratorAgent = buildOrchestratorAgent(sharedStore);

export const mastra = new Mastra({
  agents: {
    orchestrator: orchestratorAgent,
  },
  workflows: {
    plan: planWorkflow,
  },
  ...(sharedStore
    ? {
        storage: sharedStore,
      }
    : {}),
});

export { planWorkflow } from "./orchestrator/flow/plan";
