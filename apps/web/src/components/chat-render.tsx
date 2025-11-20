/**
 * Chat Part Renderer
 *
 * Renders structured AI SDK v6 message parts using native components.
 * Follows AI SDK v6 patterns: data parts, tool-result extraction, part rendering.
 */

import type { AssistantUIMessage } from "@alfred/agent";
import type { UIMessage } from "@alfred/type/stream";
import {
  extractStructuredData,
  isDataPartNamed,
  isToolResultPart,
} from "@alfred/ui/chat/parts";
import type { ReactNode } from "react";
import { Cite } from "./cite";
import { Code } from "./code";
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
  if (!data || typeof data !== "object") {
    return false;
  }
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
        validStatuses.includes(
          (task as Record<string, unknown>).status as string
        )
    )
  );
}

function isTaskData(data: unknown): data is {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
} {
  if (!data || typeof data !== "object") {
    return false;
  }
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
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.code === "string";
}

function isCiteData(data: unknown): data is {
  source: string;
  text: string;
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.source === "string" && typeof obj.text === "string";
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

type AssistantPart = AssistantUIMessage["parts"][number];

type PartRenderer = (part: AssistantPart) => ReactNode | null;

const dataPartRenderers: PartRenderer[] = [
  (part) =>
    renderStructuredPart(part, "plan", (data) =>
      isPlanData(data) ? <Plan plan={data} /> : null
    ),
  (part) =>
    renderStructuredPart(part, "task", (data) =>
      isTaskData(data) ? <Task {...data} /> : null
    ),
  (part) =>
    renderStructuredPart(part, "code", (data) =>
      isCodeData(data) ? (
        <Code code={data.code} language={data.language} />
      ) : null
    ),
  (part) =>
    renderStructuredPart(part, "cite", (data) =>
      isCiteData(data) ? <Cite source={data.source} text={data.text} /> : null
    ),
  (part) =>
    renderStructuredPart(part, "think", (data) =>
      isThinkData(data) ? <Think reasoning={data} /> : null
    ),
];

const partRenderers: PartRenderer[] = [...dataPartRenderers, renderToolResult];

export function renderAssistantPart(
  part: AssistantPart,
  _message: AssistantUIMessage
): ReactNode {
  for (const renderer of partRenderers) {
    const rendered = renderer(part);
    if (rendered) {
      return rendered;
    }
  }
  return null;
}

function renderStructuredPart(
  part: AssistantPart,
  name: string,
  render: (data: unknown) => ReactNode | null
): ReactNode | null {
  if (!isDataPartNamed(part, name)) {
    return null;
  }
  const data = extractStructuredData(part);
  return render(data);
}

function renderToolResult(part: AssistantPart): ReactNode | null {
  if (!isToolResultPart(part)) {
    return null;
  }
  const output = part.output;
  if (!output || typeof output !== "object") {
    return null;
  }

  if (isPlanData(output)) {
    return <Plan plan={output} />;
  }
  if (isTaskData(output)) {
    return <Task {...output} />;
  }

  const obj = output as Record<string, unknown>;
  if (
    typeof obj.name !== "string" ||
    typeof obj.args !== "object" ||
    obj.args === null
  ) {
    return null;
  }

  const validStatuses = ["pending", "running", "completed", "error"];
  if (typeof obj.status !== "string" || !validStatuses.includes(obj.status)) {
    return null;
  }

  return (
    <Tool
      args={obj.args as Record<string, unknown>}
      name={obj.name}
      result={obj.result}
      status={obj.status as "pending" | "running" | "completed" | "error"}
    />
  );
}

export const renderPart = (
  part: UIMessage["parts"][number],
  message: UIMessage
): ReactNode =>
  renderAssistantPart(
    part as AssistantPart,
    message as AssistantUIMessage
  );
