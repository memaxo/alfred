import type { UIMessage } from "@alfred/type/stream";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAgentLabel,
  getTimestamp,
  isDataPart,
  isReasoningPart,
  isTextPart,
  isToolCallPart,
  isToolResultPart,
  type ToolCallPart,
  type ToolResultPart,
} from "./parts";

type VirtualRange = { startIndex: number; endIndex: number };

type VirtualizedComponentProps = {
  data: UIMessage[];
  itemContent: (index: number, message: UIMessage) => ReactNode;
  rangeChanged?: (range: VirtualRange) => void;
};

type VirtualizedComponent = React.ComponentType<VirtualizedComponentProps>;

export type ChatProps = {
  messages: UIMessage[];
  onSend: (text: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  virtualized?: boolean;
  perf?: boolean;
  ListComponent?: VirtualizedComponent;
  itemContent?: (index: number, message: UIMessage) => ReactNode;
  onVoice?: () => void;
  voiceLabel?: string;
  voiceDisabled?: boolean;
  renderPart?: (
    part: UIMessage["parts"][number],
    message: UIMessage
  ) => ReactNode | null;
  renderMessageActions?: (message: UIMessage) => ReactNode | null;
};

type ToolCallBlock = {
  id: string | null;
  name: string | null;
  args: unknown;
};

type ToolResultBlock = {
  id: string | null;
  name: string | null;
  result: unknown;
};

type RenderBlock = {
  key: string;
  role: UIMessage["role"];
  agentLabel: string;
  status?: string;
  timestamp: string | null;
  text: string | null;
  reasoning: string | null;
  toolCalls: ToolCallBlock[];
  toolResults: ToolResultBlock[];
};

function buildRenderBlock(message: UIMessage, index: number): RenderBlock {
  const agentLabel = getAgentLabel(message);
  const timestamp = getTimestamp(message)?.toLocaleTimeString() ?? null;
  const metadata =
    message && typeof message === "object"
      ? ((message as { metadata?: Record<string, unknown> }).metadata ?? {})
      : {};
  const status =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, string>).status
      : undefined;

  const text =
    message.parts
      .filter(isTextPart)
      .map((part) => part.text)
      .join("") || null;

  const reasoningParts = message.parts.filter(isReasoningPart);
  const reasoning =
    reasoningParts
      .map((part) => part.text)
      .join("")
      .trim() || null;

  // ALFRED extends UIMessage with tool-call/tool-result types per stream.zod.ts
  // Cast through unknown since AI SDK's native types don't include these
  const toolCallParts = message.parts.filter(isToolCallPart) as unknown as ToolCallPart[];
  const toolCalls = toolCallParts.map((part) => ({
    id: part.toolCallId ?? null,
    name: part.toolName ?? null,
    args: part.input ?? null,
  }));

  const toolResultParts = message.parts.filter(isToolResultPart) as unknown as ToolResultPart[];
  const toolResults = toolResultParts.map((part) => ({
    id: part.toolCallId ?? null,
    name: part.toolName ?? null,
    result: part.output ?? null,
  }));

  return {
    key: message.id ?? `message-${index}`,
    role: message.role,
    agentLabel,
    status,
    timestamp,
    text,
    reasoning,
    toolCalls,
    toolResults,
  };
}

function recordPerfSnapshot(messages: UIMessage[], range?: VirtualRange) {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return;
  }

  const perfWindow = window as typeof window & {
    __perf?: Record<string, unknown>;
  };
  perfWindow.__perf = perfWindow.__perf ?? {};
  perfWindow.__perf.chat = {
    messageCount: messages.length,
    lastRender: performance.now(),
    range,
  };
}

function renderToolCalls(block: RenderBlock) {
  if (block.toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="chat-message__tool-calls">
      {block.toolCalls.map((call, index) => (
        <div
          className="chat-message__tool"
          key={call.id ?? `tool-call-${index}`}
        >
          <strong>{call.name ?? "Tool call"}</strong>
          <pre>{JSON.stringify(call.args, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

function renderToolResults(block: RenderBlock) {
  if (block.toolResults.length === 0) {
    return null;
  }

  return (
    <div className="chat-message__tool-results">
      {block.toolResults.map((result, index) => (
        <div
          className="chat-message__tool-result"
          key={result.id ?? `tool-result-${index}`}
        >
          <strong>{result.name ?? "Tool result"}</strong>
          <pre>{JSON.stringify(result.result, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

function renderDefaultMessage(
  block: RenderBlock,
  message: UIMessage,
  renderPart?: (
    part: UIMessage["parts"][number],
    message: UIMessage
  ) => ReactNode | null,
  renderMessageActions?: (message: UIMessage) => ReactNode | null
) {
  const structuredParts: ReactNode[] = [];
  if (renderPart) {
    for (const part of message.parts) {
      if (isDataPart(part) || isToolResultPart(part)) {
        const rendered = renderPart(part, message);
        if (rendered) {
          structuredParts.push(
            <div
              key={
                part.type === "tool-result"
                  ? (part.toolCallId ?? structuredParts.length)
                  : ((part as { id?: string }).id ?? structuredParts.length)
              }
            >
              {rendered}
            </div>
          );
        }
      }
    }
  }

  const actions = renderMessageActions ? renderMessageActions(message) : null;

  return (
    <article
      className={`chat-message chat-message--${block.role}`}
      data-status={block.status ?? undefined}
    >
      <header className="chat-message__header">
        <span className="chat-message__role">{block.agentLabel}</span>
        {block.timestamp ? (
          <span className="chat-message__timestamp">{block.timestamp}</span>
        ) : null}
        {block.status ? (
          <span className="chat-message__status">{block.status}</span>
        ) : null}
      </header>
      {block.text ? <p className="chat-message__text">{block.text}</p> : null}
      {block.reasoning ? (
        <div className="chat-message__reasoning">
          <p>{block.reasoning}</p>
        </div>
      ) : null}
      {structuredParts.length > 0 ? (
        <div className="chat-message__structured">{structuredParts}</div>
      ) : null}
      {actions ? (
        <footer className="chat-message__actions">{actions}</footer>
      ) : null}
      {renderPart ? null : renderToolCalls(block)}
      {renderPart ? null : renderToolResults(block)}
    </article>
  );
}

export function Chat({
  messages,
  onSend,
  placeholder = "Send a message…",
  className,
  disabled = false,
  virtualized = false,
  perf = false,
  ListComponent,
  itemContent,
  onVoice,
  voiceLabel = "Voice",
  voiceDisabled = false,
  renderPart,
  renderMessageActions,
}: ChatProps) {
  const [range, setRange] = useState<VirtualRange | undefined>(undefined);

  const handleRangeChanged = useCallback(
    (next: VirtualRange) => {
      if (!perf) {
        return;
      }
      setRange(next);
    },
    [perf]
  );

  useEffect(() => {
    if (!perf) {
      return;
    }
    const snapshotRange =
      range ??
      (messages.length > 0
        ? { startIndex: 0, endIndex: messages.length - 1 }
        : undefined);
    recordPerfSnapshot(messages, snapshotRange);
  }, [messages, perf, range]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (disabled) {
        return;
      }
      const form = event.currentTarget;
      const formData = new FormData(form);
      const value = String(formData.get("message") ?? "").trim();
      if (value.length === 0) {
        return;
      }
      onSend(value);
      form.reset();
      if (perf) {
        recordPerfSnapshot(messages);
      }
    },
    [disabled, onSend, perf, messages]
  );

  const getContent = useCallback(
    (index: number, message: UIMessage) => {
      if (itemContent) {
        return itemContent(index, message);
      }
      const block = buildRenderBlock(message, index);
      return renderDefaultMessage(
        block,
        message,
        renderPart,
        renderMessageActions
      );
    },
    [itemContent, renderPart, renderMessageActions]
  );

  const logContent = useMemo(() => {
    if (virtualized && ListComponent) {
      const VirtualList = ListComponent as React.ComponentType<any>;
      return (
        <VirtualList
          data={messages}
          itemContent={(index: number, message: UIMessage) =>
            getContent(index, message)
          }
          rangeChanged={handleRangeChanged}
        />
      );
    }

    if (messages.length === 0) {
      return (
        <div className="chat-empty">
          <p className="chat-empty__text">No messages yet</p>
        </div>
      );
    }

    return (
      <div className="chat-log">
        {messages.map((message, index) => (
          <div
            className="chat-log__item"
            key={message.id ?? `message-${index}`}
          >
            {getContent(index, message)}
          </div>
        ))}
      </div>
    );
  }, [ListComponent, getContent, handleRangeChanged, messages, virtualized]);

  return (
    <div className={className ?? "chat"}>
      <div className="chat-body">{logContent}</div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          disabled={disabled}
          name="message"
          placeholder={placeholder}
          rows={3}
        />
        <div className="chat-input__controls">
          {onVoice ? (
            <button
              className="chat-input__voice"
              disabled={voiceDisabled || disabled}
              onClick={onVoice}
              type="button"
            >
              {voiceLabel}
            </button>
          ) : null}
          <button
            className="chat-input__send"
            disabled={disabled}
            type="submit"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
