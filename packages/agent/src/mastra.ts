import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { buildOrchestratorAgent } from "./orchestrator/agent";
import { planWorkflow } from "./orchestrator/flow/plan";
import { buildAssistantAgent } from "@alfred/agent/assistant/agent";

const connectionString = process.env.DATABASE_URL;

export const sharedStore = connectionString
  ? new PostgresStore({
      connectionString,
    })
  : undefined;

export const orchestratorAgent = buildOrchestratorAgent(sharedStore);
export const assistantAgent = buildAssistantAgent(sharedStore);

export const mastra = new Mastra({
  agents: {
    orchestrator: orchestratorAgent,
    assistant: assistantAgent,
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
