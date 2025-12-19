import { createOpenAI } from "@ai-sdk/openai";
import { tool } from "ai";
import type { ZodTypeAny } from "zod";

import { toolBook } from "../assistant/src/tool/book";
import { toolFocus } from "../assistant/src/tool/focus";
import { toolHandoff } from "../assistant/src/tool/handoff";
import { toolHome } from "../assistant/src/tool/home";
import { memoryTools } from "../assistant/src/tool/memory";
import {
  toolMindscapeConnect,
  toolMindscapeRead,
} from "../assistant/src/tool/mindscape";
import { toolNote } from "../assistant/src/tool/note";
import {
  toolPreferenceGet,
  toolPreferenceSet,
} from "../assistant/src/tool/preference";
import { toolRemind } from "../assistant/src/tool/remind";
import { toolTimer } from "../assistant/src/tool/timer";
import { toolWebAssistant } from "../assistant/src/tool/web";
import { toolCodex } from "./orchestrator/tool/codex";
import { toolDocker } from "./orchestrator/tool/docker";
import { toolDroid } from "./orchestrator/tool/droid";
import { toolGit } from "./orchestrator/tool/git";
import {
  toolKnowledgeConnect,
  toolKnowledgeCorrect,
  toolKnowledgeExtract,
  toolKnowledgeQuery,
} from "./orchestrator/tool/knowledge";
import {
  toolLearnMistake,
  toolLearnPattern,
  toolLearnRecord,
} from "./orchestrator/tool/learning";
import { toolProxmox } from "./orchestrator/tool/proxmox";
import {
  toolRagDelete,
  toolRagIngest,
  toolRagList,
  toolRagQuery,
} from "./orchestrator/tool/rag";
import { toolRouter } from "./orchestrator/tool/router";
import { toolSession } from "./orchestrator/tool/session";
import { toolTicket } from "./orchestrator/tool/ticket";
import { toolWeb } from "./orchestrator/tool/web";

type LegacyTool = {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  execute: (args: any) => any;
};

type ToolMap = Record<string, ReturnType<typeof tool>>;

const DEFAULT_MODEL_ID = "openai/gpt-4o-mini";

let cachedOpenAI: ReturnType<typeof createOpenAI> | null = null;

function firstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function getModelId(): string {
  return (
    firstEnv("AI_MODEL", "OPENAI_MODEL", "MASTRA_MODEL") ?? DEFAULT_MODEL_ID
  );
}

export function getOpenAI() {
  if (cachedOpenAI) {
    return cachedOpenAI;
  }

  // Test override: allow empty client in tests if key is missing
  if (process.env.NODE_ENV === "test" && !firstEnv("OPENAI_API_KEY")) {
    return {
      chat: () => ({}),
    } as unknown as ReturnType<typeof createOpenAI>;
  }

  const apiKey = firstEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  const baseURL = firstEnv("OPENAI_BASE_URL");
  const organization = firstEnv("OPENAI_ORGANIZATION", "OPENAI_ORG");

  cachedOpenAI = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    ...(organization ? { organization } : {}),
  });

  return cachedOpenAI;
}

export function wrapLegacyToolToAISDK<TLegacy extends LegacyTool>(
  legacy: TLegacy
) {
  const outputSchema = legacy.outputSchema;

  const wrapped = tool({
    description: legacy.description,
    inputSchema: legacy.inputSchema,
    ...(outputSchema ? { outputSchema } : {}),
    async execute(input) {
      type ExecuteArgs = Parameters<TLegacy["execute"]>[0];
      const args = { input } as ExecuteArgs;
      return await legacy.execute(args);
    },
  });

  return wrapped as unknown as ReturnType<typeof tool>;
}

function wrapAll(tools: LegacyTool[]): ToolMap {
  return tools.reduce<ToolMap>((acc, legacy) => {
    acc[legacy.name] = wrapLegacyToolToAISDK(legacy);
    return acc;
  }, {});
}

const assistantToolSources: LegacyTool[] = [
  toolBook,
  toolFocus,
  toolHandoff,
  toolHome,
  toolKnowledgeQuery, // Read-only knowledge graph access
  toolNote,
  toolPreferenceGet,
  toolPreferenceSet,
  toolRemind,
  toolTimer,
  toolWebAssistant,
  toolMindscapeRead,
  toolMindscapeConnect,
  ...memoryTools,
];

const orchestratorToolSources: LegacyTool[] = [
  toolCodex,
  toolDocker,
  toolDroid,
  toolGit,
  toolKnowledgeQuery,
  toolKnowledgeExtract,
  toolKnowledgeConnect,
  toolKnowledgeCorrect,
  toolRagIngest,
  toolRagQuery,
  toolRagList,
  toolRagDelete,
  toolLearnRecord,
  toolLearnPattern,
  toolLearnMistake,
  toolSession,
  toolProxmox,
  toolRouter,
  toolTicket,
  toolWeb,
];

const assistantTools = wrapAll(assistantToolSources);
const orchestratorTools = wrapAll(orchestratorToolSources);

export function buildAssistantTools(): ToolMap {
  return assistantTools;
}

export function buildTools(): ToolMap {
  return orchestratorTools;
}
