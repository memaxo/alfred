import { createGatewayProvider } from "@ai-sdk/gateway";
import { type Tool, tool } from "ai";
import type { ZodTypeAny, z } from "zod";

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
import { toolVoiceControl, toolVoiceStatus } from "../assistant/src/tool/voice";
import { toolWebAssistant } from "../assistant/src/tool/web";
import { toolRalph } from "./orchestrator/loops/ralph";
import { toolCodex } from "./orchestrator/tool/codex/index";
import { toolCodexlog } from "./orchestrator/tool/codexlog";
import { toolCognitiveState } from "./orchestrator/tool/cognitive";
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
import { toolOpenCode } from "./orchestrator/tool/opencode";
import { toolProxmox } from "./orchestrator/tool/proxmox";
import {
  toolRagDelete,
  toolRagIngest,
  toolRagList,
  toolRagQuery,
} from "./orchestrator/tool/rag";
import { toolRouter } from "./orchestrator/tool/router";
import { toolRuntime } from "./orchestrator/tool/runtime";
import { toolSession } from "./orchestrator/tool/session";
import { toolTicket } from "./orchestrator/tool/ticket";
import { toolWeb } from "./orchestrator/tool/web";

// Base type for legacy tools - uses any for execute to maintain compatibility
// with existing tools that have varying signatures (some wrap input, some don't)
type LegacyTool = {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  // biome-ignore lint/suspicious/noExplicitAny: Legacy tools have varying execute signatures
  execute: (args: any) => any;
};

// Type for the wrapped tool - preserves schema information through the AI SDK tool() function
type WrappedTool = Tool<z.infer<ZodTypeAny>, z.infer<ZodTypeAny>>;

type ToolMap = Record<string, Tool>;

const DEFAULT_MODEL_ID = "openai/gpt-4o-mini";

let cachedGateway: ReturnType<typeof createGatewayProvider> | null = null;

function firstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function resetGatewayForTests(): void {
  cachedGateway = null;
}

export function getModelId(): string {
  return (
    firstEnv("AI_MODEL", "OPENAI_MODEL", "MASTRA_MODEL") ?? DEFAULT_MODEL_ID
  );
}

export function getOpenAI() {
  if (cachedGateway) {
    return cachedGateway;
  }

  // Test override: allow empty client in tests if key is missing
  if (process.env.NODE_ENV === "test" && !firstEnv("OPENAI_API_KEY")) {
    const stub = ((_: string) => ({})) as unknown as ReturnType<
      typeof createGatewayProvider
    >;
    // Back-compat for call sites that still expect `.languageModel(modelKey)`.
    (
      stub as unknown as { languageModel?: (modelKey: string) => unknown }
    ).languageModel = () => ({});
    return stub;
  }

  const apiKey = firstEnv("AI_GATEWAY_API_KEY", "OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("ai_gateway_api_key_missing");
  }

  const baseURL = firstEnv("AI_GATEWAY_BASE_URL", "OPENAI_BASE_URL");

  cachedGateway = createGatewayProvider({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return cachedGateway;
}

export function wrapLegacyToolToAISDK(legacy: LegacyTool): WrappedTool {
  const outputSchema = legacy.outputSchema;

  const wrapped = tool({
    description: legacy.description,
    inputSchema: legacy.inputSchema,
    ...(outputSchema ? { outputSchema } : {}),
    async execute(input: z.infer<typeof legacy.inputSchema>) {
      const args = { input };
      return await legacy.execute(args);
    },
  });

  return wrapped as WrappedTool;
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
  toolVoiceStatus,
  toolVoiceControl,
  toolWebAssistant,
  toolMindscapeRead,
  toolMindscapeConnect,
  ...memoryTools,
];

const orchestratorToolSources: LegacyTool[] = [
  toolCodex,
  toolCodexlog,
  toolCognitiveState,
  toolDocker,
  toolDroid,
  toolOpenCode,
  toolGit,
  toolKnowledgeQuery,
  toolKnowledgeExtract,
  toolKnowledgeConnect,
  toolKnowledgeCorrect,
  toolRagIngest,
  toolRagQuery,
  toolRagList,
  toolRagDelete,
  toolRalph,
  toolLearnRecord,
  toolLearnPattern,
  toolLearnMistake,
  toolSession,
  toolProxmox,
  toolRouter,
  toolRuntime,
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
