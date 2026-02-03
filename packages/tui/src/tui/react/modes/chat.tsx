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

import {
  loadChatHistory,
  loadChatPreferences,
  saveChatHistory,
  saveChatPreferences,
  type ChatMessage,
} from "../../api/history";
import { streamMLXChat } from "../../api/mlx";
import { streamAssistant, type UIMessage } from "../../api/sse";
import { useMlxHealth } from "../../hooks/usemlxhealth";
import { colors } from "../../theme";
import { fg } from "../../typography";
import { MessageContent } from "../components/message";
import { MODELS, ModelPicker, type ModelOption } from "../overlays/modelpicker";

export interface ChatModeProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "error";
}

export function ChatMode({ isOpen, onClose }: ChatModeProps) {
  const { width, height } = useTerminalDimensions();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS[0]!);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const { healthy: mlxHealthy } = useMlxHealth();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load history and preferences on mount
  useEffect(() => {
    // Load chat history
    loadChatHistory().then((history) => {
      if (history.length > 0) {
        setMessages(
          history.map((m) => ({
            content: m.content,
            id: m.id,
            role: m.role,
            status: "complete",
          }))
        );
      }
    });

    // Load model preferences
    loadChatPreferences().then((prefs) => {
      if (prefs?.selectedModelId) {
        const model = MODELS.find((m) => m.id === prefs.selectedModelId);
        if (model) {
          setSelectedModel(model);
        }
      }
    });
  }, []);

  // Save history when messages change
  useEffect(() => {
    if (messages.length > 0 && !isStreaming) {
      const history: ChatMessage[] = messages
        .filter((m) => m.status === "complete")
        .map((m) => ({
          content: m.content,
          id: m.id,
          role: m.role,
          timestamp: Date.now(),
        }));
      saveChatHistory(history);
    }
  }, [messages, isStreaming]);

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
        content,
        id: Math.random().toString(36).slice(2),
        role: "user",
        status: "complete",
      };

      const assistantId = Math.random().toString(36).slice(2);
      const assistantMsg: Message = {
        content: "",
        id: assistantId,
        role: "assistant",
        status: "streaming",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setInputValue("");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const history: UIMessage[] = [...messages, userMsg].map((m) => ({
          content: m.content,
          role: m.role,
        }));

        let stream: AsyncGenerator<import("../../api/sse").StreamChunk>;

        if (selectedModel.provider === "mlx") {
          const baseUrl =
            process.env.VLLM_MLX_BASE_URL ?? "http://localhost:8000/v1";
          const apiKey = process.env.VLLM_MLX_API_KEY;

          stream = streamMLXChat(history, {
            apiKey,
            baseUrl,
            model: selectedModel.id,
          });
        } else {
          stream = streamAssistant(history, {
            signal: abortController.signal,
          });
        }

        let accumulatedContent = "";
        for await (const chunk of stream) {
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
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    status: "error",
                    content: `${m.content}\n\nError: ${(error as Error).message}`,
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

      if (modelPickerOpen) {
        // ModelPicker handles its own keys
        return;
      }

      if (event.name === "escape") {
        onClose();
        return;
      }

      if (event.name === "m" && event.ctrl) {
        setModelPickerOpen(true);
        return;
      }

      if (event.ctrl && event.name === "c" && isStreaming) {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
        return;
      }
    },
    [isOpen, onClose, isStreaming, sendMessage, modelPickerOpen]
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
        style={{ borderColor: "#39BAE6", borderStyle: "single" }}
        title="ALFRED Chat"
        top={0}
        width={width}
      >
        <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <text
            content=" Interactive conversation with ALFRED"
            style={{ fg: "#8A9199" }}
          />
          <text
            content={` Model: ${fg(colors.primary)(selectedModel.label)} | MLX: ${mlxHealthy ? fg(colors.success)("Connected") : fg(colors.error)("Offline")} `}
          />
        </box>
      </box>

      {/* Message History */}
      <box height={historyHeight} top={headerHeight} width={width}>
        <scrollbox focused={!modelPickerOpen && !isStreaming}>
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
                  attributes: 1,
                  fg: m.role === "user" ? "#39BAE6" : "#98C379", // BOLD
                }}
              />
              <MessageContent content={m.content} width={width} />
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
          borderColor: isStreaming ? "#5C6370" : "#39BAE6",
          borderStyle: "single",
        }}
        top={headerHeight + historyHeight}
        width={width}
      >
        <input
          focused={!modelPickerOpen && !isStreaming}
          onInput={(v) => setInputValue(v)}
          onSubmit={(v) => {
            void sendMessage(v);
          }}
          placeholder="Type a message..."
          style={{
            focusedBackgroundColor: "#1A1F29",
            textColor: "#E6E6E6",
          }}
          value={inputValue}
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
          content=" [Enter] Send | [Esc] Back | [Ctrl+M] Model | [Ctrl+C] Cancel Stream"
          style={{ fg: "#0A0E14" }}
        />
      </box>

      {/* Overlays */}
      <ModelPicker
        height={height}
        isOpen={modelPickerOpen}
        onClose={() => setModelPickerOpen(false)}
        onSelect={(m) => {
          setSelectedModel(m);
          void saveChatPreferences({ selectedModelId: m.id });
        }}
        selectedId={selectedModel.id}
        width={width}
      />
    </box>
  );
}
