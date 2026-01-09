/**
 * Chat Mode - React Component
 *
 * Interactive conversation with the assistant using SSE streaming.
 * Migrated from packages/tui/src/tui/modes/chat.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamAssistant, type UIMessage } from "../../api/sse";

export type ChatModeProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "error";
};

export function ChatMode({ isOpen, onClose }: ChatModeProps) {
  const { width, height } = useTerminalDimensions();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  // Note: scrollbox doesn't have an auto-scroll prop yet, but we can manage focused index if needed

  useEffect(() => {
    if (!isOpen) {
      // Clear state when closed if needed, or keep for session persistence
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isOpen]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) {
        return;
      }

      const userMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: "user",
        content,
        status: "complete",
      };

      const assistantId = Math.random().toString(36).slice(2);
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setInputValue("");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const history: UIMessage[] = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let accumulatedContent = "";
        for await (const chunk of streamAssistant(history, {
          signal: abortController.signal,
        })) {
          if (chunk.type === "text" && chunk.content) {
            accumulatedContent += chunk.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulatedContent } : m
              )
            );
          } else if (chunk.type === "tool-call-start") {
            accumulatedContent += `\n> Calling ${chunk.toolName}...`;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulatedContent } : m
              )
            );
          } else if (chunk.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      status: "error",
                      content: `${m.content}\n\nError: ${chunk.content}`,
                    }
                  : m
              )
            );
          } else if (chunk.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, status: "complete" } : m
              )
            );
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    status: "error",
                    content: `${m.content}\n\nError: ${(err as Error).message}`,
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isStreaming]
  );

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      const alt = (event as { alt?: boolean }).alt ?? false;

      if (event.name === "escape") {
        onClose();
        return;
      }

      if (event.ctrl && event.name === "c" && isStreaming) {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
        return;
      }

      if (event.name === "enter") {
        void sendMessage(inputValue);
        return;
      }

      if (event.name === "backspace") {
        setInputValue((v) => v.slice(0, -1));
        return;
      }

      if (event.name.length === 1 && !event.ctrl && !alt) {
        setInputValue((v) => v + event.name);
        return;
      }
    },
    [isOpen, onClose, inputValue, isStreaming, sendMessage]
  );

  useKeyboard(handleKeyboard);

  if (!isOpen) {
    return null;
  }

  const headerHeight = 3;
  const inputHeight = 3;
  const footerHeight = 1;
  const historyHeight = height - headerHeight - inputHeight - footerHeight;

  return (
    <box
      height={height}
      left={0}
      style={{ backgroundColor: "#0A0E14" }}
      top={0}
      width={width}
    >
      {/* Header */}
      <box
        border
        height={headerHeight}
        style={{ borderStyle: "single", borderColor: "#39BAE6" }}
        title="ALFRED Chat"
        top={0}
        width={width}
      >
        <text
          content=" Interactive conversation with ALFRED"
          style={{ fg: "#8A9199" }}
        />
      </box>

      {/* Message History */}
      <box height={historyHeight} top={headerHeight} width={width}>
        <scrollbox focused={true}>
          {messages.length === 0 && (
            <>
              <text content="" />
              <text
                content="  No messages yet. Type something below to start."
                style={{ fg: "#5C6370" }}
              />
            </>
          )}
          {messages.map((m) => (
            <box
              key={m.id}
              style={{ marginBottom: 1, paddingLeft: 1, paddingRight: 1 }}
            >
              <text
                content={m.role === "user" ? " You" : " ALFRED"}
                style={{
                  fg: m.role === "user" ? "#39BAE6" : "#98C379",
                  attributes: 1, // BOLD
                }}
              />
              {m.content.split("\n").map((line, i) => (
                <text content={` ${line}`} key={i} style={{ fg: "#E6E6E6" }} />
              ))}
              {m.status === "streaming" && (
                <text content=" ▌" style={{ fg: "#39BAE6" }} />
              )}
            </box>
          ))}
        </scrollbox>
      </box>

      {/* Input Area */}
      <box
        border
        height={inputHeight}
        style={{
          borderStyle: "single",
          borderColor: isStreaming ? "#5C6370" : "#39BAE6",
        }}
        top={headerHeight + historyHeight}
        width={width}
      >
        <text
          content={
            isStreaming
              ? " [Streaming...]"
              : ` > ${inputValue}${inputValue ? "▌" : "Type a message...▌"}`
          }
          style={{
            fg: isStreaming ? "#5C6370" : "#E6E6E6",
          }}
        />
      </box>

      {/* Footer */}
      <box
        height={footerHeight}
        style={{ backgroundColor: "#39BAE6" }}
        top={height - footerHeight}
        width={width}
      >
        <text
          content=" [Enter] Send | [Esc] Back | [Ctrl+C] Cancel Stream"
          style={{ fg: "#0A0E14" }}
        />
      </box>
    </box>
  );
}
