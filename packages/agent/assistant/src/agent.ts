import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { buildAgentScorers } from "../../src/eval/scorer";
import { PreferenceMemoryProcessor, ToolDigestMemoryProcessor } from "./processors";
import { toolNote } from "./tool/note";
import { toolRemind } from "./tool/remind";
import { toolTimer } from "./tool/timer";
import { toolBook } from "./tool/book";
import { toolHandoff } from "./tool/handoff";
import { toolFocus } from "./tool/focus";
import { toolWebAssistant } from "./tool/web";

const WORKING_MEMORY_TEMPLATE = `# User Profile
- Name:
- Role:
- Preferences:

# Active Reminders
-

# Recent Notes
-`;

function createAssistantMemory(store?: PostgresStore) {
  if (!store) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return undefined;
    }
    store = new PostgresStore({
      connectionString,
    });
  }

  return new Memory({
    storage: store,
    options: {
      lastMessages: 12,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: WORKING_MEMORY_TEMPLATE,
      },
      semanticRecall: {
        topK: 3,
        messageRange: 2,
        scope: "resource",
      },
    },
    processors: [new PreferenceMemoryProcessor(), new ToolDigestMemoryProcessor()],
  });
}

export function buildAssistantAgent(store?: PostgresStore) {
  const rate = Number(process.env.EVALS_SAMPLING_RATE ?? "0.05");
  const samplingRate = Number.isFinite(rate) ? rate : undefined;
  const scorers = buildAgentScorers({
    agent: "assistant",
    samplingRate,
  });

  return new Agent({
    name: "assistant",
    instructions: [
      {
        role: "system",
        content:
          "You are ALFRED's personal assistant. Help with notes, reminders, timers, and bookmarks. Be concise, always confirm destructive actions, and escalate complex engineering tasks via the handoff tool.",
      },
    ],
    model: process.env.ASSISTANT_MODEL ?? process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini",
    tools: {
      note: toolNote,
      remind: toolRemind,
      timer: toolTimer,
      book: toolBook,
      handoff: toolHandoff,
      web: toolWebAssistant,
      focus: toolFocus,
    },
    memory: createAssistantMemory(store),
    ...(Object.keys(scorers).length > 0
      ? {
          scorers,
        }
      : {}),
  });
}

export type AssistantAgent = ReturnType<typeof buildAssistantAgent>;
