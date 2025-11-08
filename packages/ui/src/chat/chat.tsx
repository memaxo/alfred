import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UIMessage } from "@alfred/type/stream";

import {
  getAgentLabel,
  getTimestamp,
  isReasoningPart,
  isTextPart,
  isToolCallPart,
  isToolResultPart,
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
    metadata && typeof metadata === "object" ? (metadata as Record<string, string>).status : undefined;

  const text =
    message.parts.filter(isTextPart).map(part => part.text).join("") || null;

  const reasoningParts = message.parts.filter(isReasoningPart);
  const reasoning =
    reasoningParts.map(part => part.reasoning).join("").trim() || null;

  const toolCalls = message.parts
    .filter(isToolCallPart)
    .map(part => ({
      id: part.toolCallId ?? null,
      name: part.toolName ?? null,
      args: (part.args ?? part.input) ?? null,
    }));

  const toolResults = message.parts
    .filter(isToolResultPart)
    .map(part => ({
      id: part.toolCallId ?? null,
      name: part.toolName ?? null,
      result: part.result ?? null,
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
        <div key={call.id ?? `tool-call-${index}`} className="chat-message__tool">
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
        <div key={result.id ?? `tool-result-${index}`} className="chat-message__tool-result">
          <strong>{result.name ?? "Tool result"}</strong>
          <pre>{JSON.stringify(result.result, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

function renderDefaultMessage(block: RenderBlock) {
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
      {renderToolCalls(block)}
      {renderToolResults(block)}
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
}: ChatProps) {
  const [range, setRange] = useState<VirtualRange | undefined>(undefined);

  const handleRangeChanged = useCallback(
    (next: VirtualRange) => {
      if (!perf) return;
      setRange(next);
    },
    [perf],
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
      const formData = new FormData(event.currentTarget);
      const value = String(formData.get("message") ?? "").trim();
      if (value.length === 0) {
        return;
      }
      onSend(value);
      event.currentTarget.reset();
      if (perf) {
        recordPerfSnapshot(messages);
      }
    },
    [disabled, onSend, perf, messages],
  );

  const getContent = useCallback(
    (index: number, message: UIMessage) => {
      if (itemContent) {
        return itemContent(index, message);
      }
      const block = buildRenderBlock(message, index);
      return renderDefaultMessage(block);
    },
    [itemContent],
  );

  const logContent = useMemo(() => {
    if (virtualized && ListComponent) {
      const VirtualList = ListComponent as React.ComponentType<any>;
      return (
        <VirtualList
          data={messages}
          itemContent={(index: number, message: UIMessage) => getContent(index, message)}
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
          <div key={message.id ?? `message-${index}`} className="chat-log__item">
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
          name="message"
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
        />
        <div className="chat-input__controls">
          {onVoice ? (
            <button
              type="button"
              onClick={onVoice}
              disabled={voiceDisabled || disabled}
              className="chat-input__voice"
            >
              {voiceLabel}
            </button>
          ) : null}
          <button type="submit" disabled={disabled} className="chat-input__send">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
