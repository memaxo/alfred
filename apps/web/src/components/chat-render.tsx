/**
 * Chat Part Renderer
 *
 * Renders structured AI SDK v6 message parts using native components.
 * Follows AI SDK v6 patterns: data parts, tool-result extraction, part rendering.
 */

import type { UIComponent } from "@alfred/type/genui";
import type { UIMessage } from "@alfred/type/stream";
import type { ReactNode } from "react";

type AssistantUIMessage = UIMessage;

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
import { containsFormComponents } from "@alfred/ui/genui";

import {
  GenUIErrorBoundary,
  isGenUIToolResult,
  isUIDataPart,
  UISchemaRenderer,
} from "@/components/genui";
import { GenUIFormWrapper } from "@/components/genui/form-wrapper";

import { Artifact } from "./artifact";
import { Branch } from "./branch";
import { Canvas } from "./canvas";
import { Cite } from "./cite";
import { Code } from "./code";
import { Confirm } from "./confirm";
import { Edge } from "./edge";
import { Node } from "./node";
import { Panel } from "./panel";
import { Plan } from "./plan";
import { Preview } from "./preview";
import { Queue } from "./queue";
import { Response as MarkdownResponse } from "./response";
import { Task } from "./task";
import { Think } from "./think";
import { Thought } from "./thought";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./tool";

interface TaskData {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
}

function isPlanData(data: unknown): data is {
  requirement: string;
  tasks: TaskData[];
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const validStatuses = new Set(["pending", "running", "completed", "error"]);
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
        validStatuses.has((task as Record<string, unknown>).status as string)
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

function isThinkData(data: unknown): data is {
  id: string;
  thought: string;
  confidence?: number;
}[] {
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

function isBranchData(data: unknown): data is {
  branches: {
    id: string;
    label: string;
    reasoning: string;
    selected?: boolean;
  }[];
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const { branches } = obj;
  return (
    Array.isArray(branches) &&
    branches.every(
      (branch) =>
        branch &&
        typeof branch === "object" &&
        typeof (branch as Record<string, unknown>).id === "string" &&
        typeof (branch as Record<string, unknown>).label === "string" &&
        typeof (branch as Record<string, unknown>).reasoning === "string"
    )
  );
}

function isThoughtData(data: unknown): data is {
  thoughts: {
    id: string;
    step: number;
    thought: string;
    evidence?: string[];
  }[];
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const { thoughts } = obj;
  return (
    Array.isArray(thoughts) &&
    thoughts.every(
      (thought) =>
        thought &&
        typeof thought === "object" &&
        typeof (thought as Record<string, unknown>).id === "string" &&
        typeof (thought as Record<string, unknown>).step === "number" &&
        typeof (thought as Record<string, unknown>).thought === "string"
    )
  );
}

function isQueueData(data: unknown): data is {
  items: {
    id: string;
    title: string;
    priority: "low" | "medium" | "high";
  }[];
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const { items } = obj;
  return (
    Array.isArray(items) &&
    items.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).title === "string" &&
        typeof (item as Record<string, unknown>).priority === "string"
    )
  );
}

function isPreviewData(data: unknown): data is {
  url: string;
  title: string;
  status: "preview" | "active" | "failed";
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const { status } = obj;
  return (
    typeof obj.url === "string" &&
    typeof obj.title === "string" &&
    (status === "preview" || status === "active" || status === "failed")
  );
}

function isArtifactData(data: unknown): data is {
  name: string;
  path: string;
  kind: "file" | "directory" | "code";
  size?: number;
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const { kind } = obj;
  return (
    typeof obj.name === "string" &&
    typeof obj.path === "string" &&
    (kind === "file" || kind === "directory" || kind === "code")
  );
}

function isPanelData(
  data: unknown
): data is { title: string; content?: string } {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.title === "string" &&
    (obj.content === undefined || typeof obj.content === "string")
  );
}

function isNodeData(data: unknown): data is {
  id: string;
  label: string;
  type: "task" | "decision" | "action";
  status: "pending" | "running" | "completed" | "error";
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const { type } = obj;
  const { status } = obj;
  return (
    typeof obj.id === "string" &&
    typeof obj.label === "string" &&
    (type === "task" || type === "decision" || type === "action") &&
    (status === "pending" ||
      status === "running" ||
      status === "completed" ||
      status === "error")
  );
}

function isEdgeData(data: unknown): data is {
  from: string;
  to: string;
  label?: string;
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.from === "string" &&
    typeof obj.to === "string" &&
    (obj.label === undefined || typeof obj.label === "string")
  );
}

function isCanvasData(data: unknown): data is {
  nodes: {
    id: string;
    label: string;
    type: "task" | "decision" | "action";
    status: "pending" | "running" | "completed" | "error";
  }[];
  edges?: { from: string; to: string; label?: string }[];
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const { nodes } = obj;
  const { edges } = obj;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return false;
  }
  const nodesOk = nodes.every((node) => isNodeData(node));
  const edgesOk =
    edges === undefined ||
    (Array.isArray(edges) && edges.every((edge) => isEdgeData(edge)));
  return nodesOk && edgesOk;
}

type AssistantPart = AssistantUIMessage["parts"][number];

type PartRenderer = (
  part: AssistantPart,
  message: AssistantUIMessage,
  handlers?: PartHandlers,
  conversationId?: string | null
) => ReactNode | null;

interface PartHandlers {
  onAddToolApprovalResponse?: (args: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => void;
}

/**
 * Render dynamic GenUI components from data-ui parts.
 *
 * This allows the LLM to return arbitrary UI schemas that
 * are interpreted and rendered using the component registry.
 */
function renderGenUI(
  part: AssistantPart,
  message: AssistantUIMessage,
  _handlers?: PartHandlers,
  conversationId?: string | null
): ReactNode | null {
  if (!isUIDataPart(part)) {
    return null;
  }

  const schema = part.ui;

  // If schema contains form components and we have conversationId, wrap with form wrapper
  if (containsFormComponents(schema) && conversationId) {
    const formId = extractFormId(schema);
    const toolCallId = extractToolCallIdFromMessage(message, part);
    const formData =
      typeof part === "object" && "data" in part ? part.data : undefined;

    return (
      <GenUIErrorBoundary schema={schema}>
        <GenUIFormWrapper
          conversationId={conversationId}
          formData={formData}
          formId={formId}
          schema={schema}
          toolCallId={toolCallId}
        />
      </GenUIErrorBoundary>
    );
  }

  // Regular GenUI rendering
  return (
    <GenUIErrorBoundary schema={schema}>
      <UISchemaRenderer schema={schema} />
    </GenUIErrorBoundary>
  );
}

function extractFormId(schema: UIComponent): string {
  if (
    typeof schema.props === "object" &&
    schema.props !== null &&
    "formId" in schema.props &&
    typeof schema.props.formId === "string"
  ) {
    return schema.props.formId;
  }
  return `form-${schema.component}-${schema.key ?? "default"}`;
}

function renderGenUIOutput(output: unknown): ReactNode | null {
  if (!isGenUIToolResult(output)) {
    return null;
  }
  return (
    <GenUIErrorBoundary schema={output.ui}>
      <UISchemaRenderer schema={output.ui} />
    </GenUIErrorBoundary>
  );
}

const dataPartRenderers: PartRenderer[] = [
  // GenUI dynamic component renderer (must come first)
  (part, message, handlers, conversationId) =>
    renderGenUI(part, message, handlers, conversationId),
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
  (part) =>
    renderStructuredPart(part, "branch", (data) =>
      isBranchData(data) ? <Branch branches={data.branches} /> : null
    ),
  (part) =>
    renderStructuredPart(part, "thought", (data) =>
      isThoughtData(data) ? <Thought thoughts={data.thoughts} /> : null
    ),
  (part) =>
    renderStructuredPart(part, "queue", (data) =>
      isQueueData(data) ? <Queue items={data.items} /> : null
    ),
  (part) =>
    renderStructuredPart(part, "preview", (data) =>
      isPreviewData(data) ? (
        <Preview status={data.status} title={data.title} url={data.url} />
      ) : null
    ),
  (part) =>
    renderStructuredPart(part, "artifact", (data) =>
      isArtifactData(data) ? (
        <Artifact
          kind={data.kind}
          name={data.name}
          path={data.path}
          size={data.size}
        />
      ) : null
    ),
  (part) =>
    renderStructuredPart(part, "panel", (data) =>
      isPanelData(data) ? (
        <Panel title={data.title}>{data.content ?? null}</Panel>
      ) : null
    ),
  (part) =>
    renderStructuredPart(part, "node", (data) =>
      isNodeData(data) ? (
        <Node
          id={data.id}
          label={data.label}
          status={data.status}
          type={data.type}
        />
      ) : null
    ),
  (part) =>
    renderStructuredPart(part, "edge", (data) =>
      isEdgeData(data) ? (
        <Edge from={data.from} label={data.label} to={data.to} />
      ) : null
    ),
  (part) =>
    renderStructuredPart(part, "canvas", (data) =>
      isCanvasData(data) ? (
        <Canvas>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-3">
              {data.nodes.map((node) => (
                <Node
                  id={node.id}
                  key={node.id}
                  label={node.label}
                  status={node.status}
                  type={node.type}
                />
              ))}
            </div>
            {data.edges && data.edges.length > 0 ? (
              <div className="flex flex-1 flex-col gap-2">
                {data.edges.map((edge, idx) => (
                  <Edge
                    from={edge.from}
                    key={`${edge.from}-${edge.to}-${idx}`}
                    label={edge.label}
                    to={edge.to}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Canvas>
      ) : null
    ),
];

function renderText(part: AssistantPart): ReactNode | null {
  if (isTextPart(part)) {
    return <MarkdownResponse>{part.text}</MarkdownResponse>;
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
  handlers?: PartHandlers,
  conversationId?: string | null
): ReactNode {
  for (const renderer of partRenderers) {
    const rendered = renderer(part, message, handlers, conversationId);
    if (rendered) {
      return rendered;
    }
  }
  return null;
}

function extractToolCallIdFromMessage(
  message: AssistantUIMessage,
  part: AssistantPart
): string | undefined {
  // Look for associated tool-call part in the same message
  if (isUIDataPart(part) && part.id) {
    const toolCallPart = message.parts.find((p) => {
      if (!isToolCallPart(p)) {
        return false;
      }
      const toolCall = p as unknown as ToolCallPart;
      return toolCall.toolCallId === part.id;
    });
    if (toolCallPart) {
      return (toolCallPart as unknown as ToolCallPart).toolCallId;
    }
  }
  return;
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

  const { input } = invocation;
  const { output } = invocation;
  const errorText =
    state === "output-denied"
      ? "Denied"
      : (typeof invocation.errorText === "string"
        ? invocation.errorText
        : undefined);

  return (
    <Tool defaultOpen={state !== "output-available"}>
      <ToolHeader state={state} title={title} type="tool-call" />
      <ToolContent>
        {input !== undefined ? <ToolInput input={input} /> : null}
        {state === "approval-requested" &&
        approvalId &&
        handlers?.onAddToolApprovalResponse ? (
          <Confirm
            description="This tool invocation requires explicit approval."
            onCancel={() =>
              handlers.onAddToolApprovalResponse?.({
                id: approvalId,
                approved: false,
              })
            }
            onConfirm={() =>
              handlers.onAddToolApprovalResponse?.({
                id: approvalId,
                approved: true,
              })
            }
            requireBio={true}
            title={`Approve: ${title}`}
          />
        ) : null}
        {state === "output-available" && output !== undefined ? (
          <ToolOutput errorText={undefined} output={output} />
        ) : (state === "output-error" || state === "output-denied" ? (
          <ToolOutput errorText={errorText} output={output} />
        ) : null)}
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

  const genui = renderGenUIOutput(output);
  if (genui) {
    return genui;
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
  (handlers?: PartHandlers, conversationId?: string | null) =>
  (part: UIMessage["parts"][number], message: UIMessage): ReactNode =>
    renderAssistantPart(
      part as AssistantPart,
      message as AssistantUIMessage,
      handlers,
      conversationId
    );

// Deprecated: use createPartRenderer
export const renderPart = (
  part: UIMessage["parts"][number],
  message: UIMessage
): ReactNode =>
  renderAssistantPart(part as AssistantPart, message as AssistantUIMessage);
