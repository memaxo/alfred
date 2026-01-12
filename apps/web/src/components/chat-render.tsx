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
  getToolInvocationName,
  getToolInvocationState,
  isDataPartNamed,
  isReasoningPart,
  isTextPart,
  isToolCallPart,
  isToolInvocationPart,
  isToolResultPart,
  type ToolCallPart,
  type ToolInvocationPart,
  type ToolResultPart,
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

type TaskData = {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
};

function isPlanData(data: unknown): data is {
  requirement: string;
  tasks: TaskData[];
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

function isTaskData(data: unknown): data is TaskData {
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
  onAddToolApprovalResponse?: (args: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => void;
};

const dataPartRenderers: PartRenderer[] = [
  (part) =>
    renderStructuredPart(part, "plan", (data) => {
      if (isPlanData(data)) {
        return <Plan plan={data} />;
      }
      return null;
    }),
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

function renderText(part: AssistantPart): ReactNode | null {
  if (isTextPart(part)) {
    return <div className="whitespace-pre-wrap">{part.text}</div>;
  }
  return null;
}

function renderReasoning(part: AssistantPart): ReactNode | null {
  if (isReasoningPart(part)) {
    return (
      <div className="text-muted-foreground italic opacity-70">{part.text}</div>
    );
  }
  return null;
}

const partRenderers: PartRenderer[] = [
  renderText,
  renderReasoning,
  ...dataPartRenderers,
  renderToolInvocation,
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
  _handlers?: PartHandlers
): ReactNode | null {
  if (!isToolCallPart(part)) {
    return null;
  }

  // Cast to ALFRED's tool-call type (validated by isToolCallPart)
  const toolCall = part as unknown as ToolCallPart;
  const { toolCallId, toolName, input } = toolCall;

  // Look ahead for matching result
  const resultPart = message.parts.find((p) => {
    if (!isToolResultPart(p)) {
      return false;
    }
    return (p as unknown as ToolResultPart).toolCallId === toolCallId;
  });

  const state = resultPart ? "output-available" : "input-available";

  // Get result for output display
  const output = resultPart
    ? (resultPart as unknown as ToolResultPart).output
    : undefined;

  return (
    <Tool defaultOpen={!resultPart}>
      <ToolHeader state={state} title={toolName} type="tool-call" />
      <ToolContent>
        <ToolInput input={input} />
        {output !== undefined ? (
          <ToolOutput errorText={undefined} output={output} />
        ) : null}
      </ToolContent>
    </Tool>
  );
}

function renderToolInvocation(
  part: AssistantPart,
  _message: AssistantUIMessage,
  handlers?: PartHandlers
): ReactNode | null {
  if (!isToolInvocationPart(part)) {
    return null;
  }

  const invocation = part as unknown as ToolInvocationPart;
  const title = getToolInvocationName(invocation);
  const state = getToolInvocationState(invocation);

  const approvalId =
    invocation.approval && typeof invocation.approval.id === "string"
      ? invocation.approval.id
      : null;

  const input = invocation.input;
  const output = invocation.output;
  const errorText =
    state === "output-denied"
      ? "Denied"
      : typeof invocation.errorText === "string"
        ? invocation.errorText
        : undefined;

  return (
    <Tool defaultOpen={state !== "output-available"}>
      <ToolHeader state={state} title={title} type="tool-call" />
      <ToolContent>
        {input !== undefined ? <ToolInput input={input} /> : null}
        {state === "approval-requested" &&
        approvalId &&
        handlers?.onAddToolApprovalResponse ? (
          <ToolActions
            onApprove={() =>
              handlers.onAddToolApprovalResponse?.({
                id: approvalId,
                approved: true,
              })
            }
            onDeny={() =>
              handlers.onAddToolApprovalResponse?.({
                id: approvalId,
                approved: false,
              })
            }
            state="approval-requested"
          />
        ) : null}
        {state === "output-available" && output !== undefined ? (
          <ToolOutput errorText={undefined} output={output} />
        ) : state === "output-error" || state === "output-denied" ? (
          <ToolOutput errorText={errorText} output={output} />
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

  // Cast to ALFRED's tool-result type (validated by isToolResultPart)
  const toolResult = part as unknown as ToolResultPart;
  const { toolCallId, toolName, output } = toolResult;

  // Check if we already rendered this in a tool-call block
  const callPart = message.parts.find((p) => {
    if (!isToolCallPart(p)) {
      return false;
    }
    return (p as unknown as ToolCallPart).toolCallId === toolCallId;
  });

  // If we found the call part, suppress this standalone result
  // (it was rendered inside the tool-call block)
  if (callPart) {
    return null;
  }

  // Fallback handling for structured data in output
  if (isPlanData(output)) {
    return <Plan plan={output} />;
  }
  if (isTaskData(output)) {
    return (
      <Task
        id={output.id}
        progress={output.progress}
        status={output.status}
        title={output.title}
      />
    );
  }

  return (
    <Tool defaultOpen={true}>
      <ToolHeader
        state="output-available"
        title={toolName ?? "Tool Result"}
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
