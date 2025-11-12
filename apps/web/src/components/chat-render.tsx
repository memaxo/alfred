/**
 * Chat Part Renderer
 *
 * Renders structured AI SDK v6 message parts using native components.
 * Follows AI SDK v6 patterns: data parts, tool-result extraction, part rendering.
 */

import type { UIMessage } from "@alfred/type/stream";
import type { ReactNode } from "react";
import {
  extractStructuredData,
  isDataPartNamed,
  isToolResultPart,
} from "@alfred/ui/chat/parts";
import { Code } from "./code";
import { Cite } from "./cite";
import { Plan } from "./plan";
import { Task } from "./task";
import { Think } from "./think";
import { Tool } from "./tool";

function isPlanData(data: unknown): data is {
  requirement: string;
  tasks: Array<{
    id: string;
    title: string;
    status: "pending" | "running" | "completed" | "error";
    subtasks?: unknown[];
  }>;
} {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const validStatuses = ["pending", "running", "completed", "error"];
  return (
    typeof obj.requirement === "string" &&
    Array.isArray(obj.tasks) &&
    obj.tasks.every(
      (task) =>
        task &&
        typeof task === "object" &&
        typeof (task as Record<string, unknown>).id === "string" &&
        typeof (task as Record<string, unknown>).title === "string" &&
        typeof (task as Record<string, unknown>).status === "string" &&
        validStatuses.includes((task as Record<string, unknown>).status as string)
    )
  );
}

function isTaskData(data: unknown): data is {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
} {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const validStatuses = ["pending", "running", "completed", "error"];
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.status === "string" &&
    validStatuses.includes(obj.status)
  );
}

function isCodeData(data: unknown): data is {
  code: string;
  language?: string;
} {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.code === "string";
}

function isCiteData(data: unknown): data is {
  source: string;
  text: string;
} {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.source === "string" && typeof obj.text === "string"
  );
}

function isToolData(data: unknown): data is {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "error";
} {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const validStatuses = ["pending", "running", "completed", "error"];
  return (
    typeof obj.name === "string" &&
    typeof obj.args === "object" &&
    obj.args !== null &&
    typeof obj.status === "string" &&
    validStatuses.includes(obj.status)
  );
}

function isThinkData(data: unknown): data is Array<{
  id: string;
  thought: string;
  confidence?: number;
}> {
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

export function renderPart(
  part: UIMessage["parts"][number],
  message: UIMessage
): ReactNode {
  // Handle data parts
  if (isDataPartNamed(part, "plan")) {
    const data = extractStructuredData(part);
    if (isPlanData(data)) {
      return <Plan plan={data} />;
    }
  }

  if (isDataPartNamed(part, "task")) {
    const data = extractStructuredData(part);
    if (isTaskData(data)) {
      return <Task {...data} />;
    }
  }

  if (isDataPartNamed(part, "code")) {
    const data = extractStructuredData(part);
    if (isCodeData(data)) {
      return <Code code={data.code} language={data.language} />;
    }
  }

  if (isDataPartNamed(part, "cite")) {
    const data = extractStructuredData(part);
    if (isCiteData(data)) {
      return <Cite source={data.source} text={data.text} />;
    }
  }

  if (isDataPartNamed(part, "think")) {
    const data = extractStructuredData(part);
    if (isThinkData(data)) {
      return <Think reasoning={data} />;
    }
  }

  // Handle tool-result parts with structured output
  if (isToolResultPart(part)) {
    const output = part.output;
    if (output && typeof output === "object") {
      const obj = output as Record<string, unknown>;

      // Check for plan in tool output
      if (isPlanData(output)) {
        return <Plan plan={output} />;
      }

      // Check for task in tool output
      if (isTaskData(output)) {
        return <Task {...output} />;
      }

      // Check for tool data structure
      if (
        typeof obj.name === "string" &&
        typeof obj.args === "object" &&
        obj.args !== null
      ) {
        // Validate status to prevent masking errors
        const validStatuses = ["pending", "running", "completed", "error"];
        if (typeof obj.status !== "string" || !validStatuses.includes(obj.status)) {
          return null; // Don't render tool with invalid/missing status
        }
        return (
          <Tool
            name={obj.name}
            args={obj.args as Record<string, unknown>}
            result={obj.result}
            status={obj.status as "pending" | "running" | "completed" | "error"}
          />
        );
      }
    }
  }

  return null;
}

