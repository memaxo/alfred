/**
 * Message Parser Utility
 *
 * Extracts structured data from UIMessage parts for component rendering.
 * Pure functions following AI SDK v6 part patterns.
 */

import type { UIMessage } from "@alfred/type/stream";

type AssistantUIMessage = UIMessage;
type OrchestratorUIMessage = UIMessage;

import {
  extractStructuredData,
  isDataPartNamed,
  isToolResultPart,
  type ToolResultPart,
} from "@alfred/ui/chat/parts";

type AgentMessage = AssistantUIMessage | OrchestratorUIMessage;

export interface ParsedPlan {
  requirement: string;
  tasks: {
    id: string;
    title: string;
    status: "pending" | "running" | "completed" | "error";
    subtasks?: unknown[];
  }[];
}

export interface ParsedTask {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
}

export interface ParsedTool {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "error";
}

export interface ParsedCode {
  code: string;
  language?: string;
}

export interface ParsedCite {
  source: string;
  text: string;
}

export type ParsedThink = {
  id: string;
  thought: string;
  confidence?: number;
}[];

export interface ParsedMessage {
  id: string;
  role: AgentMessage["role"];
  plans: ParsedPlan[];
  tasks: ParsedTask[];
  tools: ParsedTool[];
  codes: ParsedCode[];
  cites: ParsedCite[];
  thinks: ParsedThink[];
}

function isPlanData(data: unknown): data is ParsedPlan {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.requirement === "string" &&
    Array.isArray(obj.tasks) &&
    obj.tasks.every(
      (task) =>
        task &&
        typeof task === "object" &&
        typeof (task as Record<string, unknown>).id === "string" &&
        typeof (task as Record<string, unknown>).title === "string"
    )
  );
}

function isTaskData(data: unknown): data is ParsedTask {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.status === "string"
  );
}

function isToolData(data: unknown): data is ParsedTool {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.args === "object" &&
    obj.args !== null
  );
}

function isCodeData(data: unknown): data is ParsedCode {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.code === "string";
}

function isCiteData(data: unknown): data is ParsedCite {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.source === "string" && typeof obj.text === "string";
}

function isThinkData(data: unknown): data is ParsedThink {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).thought === "string"
    )
  );
}

export function parseStructuredMessage(message: AgentMessage): ParsedMessage {
  const result: ParsedMessage = {
    id: message.id ?? "",
    role: message.role,
    plans: [],
    tasks: [],
    tools: [],
    codes: [],
    cites: [],
    thinks: [],
  };

  for (const part of message.parts) {
    // Handle data parts
    if (isDataPartNamed(part, "plan")) {
      const data = extractStructuredData(part);
      if (isPlanData(data)) {
        result.plans.push(data);
      }
    } else if (isDataPartNamed(part, "task")) {
      const data = extractStructuredData(part);
      if (isTaskData(data)) {
        result.tasks.push(data);
      }
    } else if (isDataPartNamed(part, "code")) {
      const data = extractStructuredData(part);
      if (isCodeData(data)) {
        result.codes.push(data);
      }
    } else if (isDataPartNamed(part, "cite")) {
      const data = extractStructuredData(part);
      if (isCiteData(data)) {
        result.cites.push(data);
      }
    } else if (isDataPartNamed(part, "think")) {
      const data = extractStructuredData(part);
      if (isThinkData(data)) {
        result.thinks.push(data);
      }
    } else if (isToolResultPart(part)) {
      // Handle tool-result parts
      // Type guard is runtime-correct, but we cast due to ALFRED's custom tool-result
      // part type not existing in the AI SDK's UIMessage typings.
      const toolResultPart = part as unknown as ToolResultPart;
      const { output } = toolResultPart;
      if (output && typeof output === "object") {
        const obj = output as Record<string, unknown>;

        if (isPlanData(output)) {
          result.plans.push(output);
        } else if (isTaskData(output)) {
          result.tasks.push(output);
        } else if (isToolData(output)) {
          const status =
            typeof obj.status === "string"
              ? (obj.status as "pending" | "running" | "completed" | "error")
              : "completed";
          result.tools.push({
            name: obj.name as string,
            args: obj.args as Record<string, unknown>,
            result: obj.result,
            status,
          });
        }
      }
    }
  }

  return result;
}
