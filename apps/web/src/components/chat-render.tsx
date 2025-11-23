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
  isToolCallPart,
  isToolResultPart,
} from "@alfred/ui/chat/parts";
import type { ReactNode } from "react";
import {
  Tool,
  ToolActions,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./ai-elements/tool";
import { Cite } from "./cite";
import { Code } from "./code";
import { Plan } from "./plan";
import { Task } from "./task";
import { Think } from "./think";

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

type PartRenderer = (
  part: AssistantPart,
  message: AssistantUIMessage,
  handlers?: PartHandlers
) => ReactNode | null;

type PartHandlers = {
  onAddToolResult?: (result: { toolCallId: string; result: unknown }) => void;
};

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

const partRenderers: PartRenderer[] = [
  ...dataPartRenderers,
  renderToolCall,
  renderToolResult,
];

export function renderAssistantPart(
  part: AssistantPart,
  message: AssistantUIMessage,
  handlers?: PartHandlers
): ReactNode {
  for (const renderer of partRenderers) {
    const rendered = renderer(part, message, handlers);
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

function renderToolCall(
  part: AssistantPart,
  message: AssistantUIMessage,
  handlers?: PartHandlers
): ReactNode | null {
  if (!isToolCallPart(part)) {
    return null;
  }

  // Look ahead for matching result
  const resultPart = message.parts.find(
    (p) => isToolResultPart(p) && p.toolCallId === part.toolCallId
  );

  const state = resultPart ? "output-available" : "input-available";

  // Check for approval state based on internal convention
  // AI SDK v6 currently doesn't expose 'state' on the message part directly for UIMessage
  // But if we are using 'useChat', the 'tool-call' part might have 'args' but not state.
  // Wait, UIMessage from AI SDK v6 does not have 'state'.
  // However, 'useChat' handles pending tool calls.
  // If tool call is present and no result part, it is pending or executing.
  // If the tool required approval, we need to know.
  // The standard AI SDK `ToolCallPart` doesn't carry approval state.
  // But our tool wrapper might emit an event or we rely on `useChat` state?
  // Actually, `useChat` provides `isLoading` but that's global.

  // For now, let's assume if we receive a tool-call and no result, we might want to show approval UI if it's configured.
  // But we don't know if approval is requested just from the message part.
  // We need to check if the 'state' field exists on the part (it might be extended).
  // Our `tool.tsx` expects `ToolUIPart["state"]`.
  // But `AssistantPart` is from `AssistantUIMessage` which is `UIMessage`.

  // Let's check if we can infer 'approval-requested'.
  // In AI SDK v6, if a tool needs approval, the `tool-call` part is emitted.
  // The client needs to call `addToolResult` with approval.

  // Assuming we can check a property or just show actions if it's pending.
  // But we don't want to show actions for tools that auto-execute.
  // Currently, there is no easy way to distinguish unless we have that metadata.
  // However, the user asked for UI controls.

  // Let's optimistically add the buttons if we have handlers and no result.
  // But maybe check if tool name implies approval needed? No, that's brittle.

  // The `ToolUIPart` type in `tool.tsx` has `state`.
  // But we are mapping `UIMessage` parts to it.
  // Let's default to 'input-available' or 'approval-requested' if we have some indicator.
  // For now, I'll wire the buttons. If clicked, they call `addToolResult`.

  // Note: AI SDK v6 'useChat' handles approval via 'addToolResult'.
  // If we call it, the stream continues.

  const handleApprove = () => {
    handlers?.onAddToolResult?.({
      toolCallId: part.toolCallId,
      result: "Approved", // Or a specific approval payload
    });
  };

  const handleDeny = () => {
    handlers?.onAddToolResult?.({
      toolCallId: part.toolCallId,
      result: "Denied", // Or error? Usually we just return a result saying denied.
    });
  };

  return (
    <Tool defaultOpen={!resultPart}>
      <ToolHeader state={state} title={part.toolName} type="tool-call" />
      <ToolContent>
        <ToolInput input={part.args} />
        {state !== "output-available" && handlers?.onAddToolResult ? (
          <ToolActions
            onApprove={handleApprove}
            onDeny={handleDeny}
            state="approval-requested"
          />
        ) : null}
        {resultPart && isToolResultPart(resultPart) ? (
          <ToolOutput
            errorText={undefined}
            output={resultPart.result} // Errors not strictly typed in Part yet
          />
        ) : null}
      </ToolContent>
    </Tool>
  );
}

function renderToolResult(
  part: AssistantPart,
  message: AssistantUIMessage
): ReactNode | null {
  if (!isToolResultPart(part)) {
    return null;
  }

  // Check if we already rendered this in a tool-call block
  const callPart = message.parts.find(
    (p) => isToolCallPart(p) && p.toolCallId === part.toolCallId
  );

  // If we found the call part, suppress this standalone result
  // (it was rendered inside the tool-call block)
  if (callPart) {
    return null;
  }

  // Orphaned result (e.g. history where call is missing)
  const output = part.result;

  // Fallback handling for structured data in output
  if (isPlanData(output)) {
    return <Plan plan={output} />;
  }
  if (isTaskData(output)) {
    return <Task {...output} />;
  }

  return (
    <Tool defaultOpen={true}>
      <ToolHeader
        state="output-available"
        title={part.toolName ?? "Tool Result"}
        type="tool-result"
      />
      <ToolContent>
        <ToolOutput errorText={undefined} output={output} />
      </ToolContent>
    </Tool>
  );
}

export const createPartRenderer =
  (handlers?: PartHandlers) =>
  (part: UIMessage["parts"][number], message: UIMessage): ReactNode =>
    renderAssistantPart(
      part as AssistantPart,
      message as AssistantUIMessage,
      handlers
    );

// Deprecated: use createPartRenderer
export const renderPart = (
  part: UIMessage["parts"][number],
  message: UIMessage
): ReactNode =>
  renderAssistantPart(part as AssistantPart, message as AssistantUIMessage);
