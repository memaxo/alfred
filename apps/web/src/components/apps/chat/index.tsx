"use client";

/**
 * Chat Application - Phase 2 Core Application
 *
 * AI conversation interface with voice-first experience.
 * Supports multiple agents via Agent Client Protocol.
 *
 * Features:
 * - Virtualized message list for performance
 * - Voice input/output with waveform
 * - Thread sidebar for history
 * - Context panel for RAG
 * - Agent selector (Claude, Codex, Roo, Droid)
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.1
 */

import { PanelLeft, PanelRight } from "lucide-react";
import { useCallback, useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { cn } from "@/lib/utils";

import { AgentSelector } from "./agent-selector";
import { ContextPanel } from "./context-panel";
import { InputArea } from "./input-area";
import { MessageList } from "./message-list";
import { ThreadSidebar } from "./thread-sidebar";
import { VoiceIndicator } from "./voice-indicator";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ChatAppProps {
  windowId?: string;
  className?: string;
  // Can be used standalone or wrapped in window chrome
  standalone?: boolean;
}

type AgentType = "assistant" | "codex" | "droid" | "roo" | "claude";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ChatApp({
  windowId: _windowId,
  className,
  standalone: _standalone = false,
}: ChatAppProps) {
  const [showThreads, setShowThreads] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("assistant");

  const {
    messages,
    handleSend,
    handleRegenerate,
    handleEdit,
    isRecording,
    toggleVoice,
    status,
    error,
  } = useChatLogic({
    initialAgent: selectedAgent === "assistant" ? "assistant" : "orchestrator",
  });

  const handleSubmit = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  const handleAgentChange = useCallback((agent: AgentType) => {
    setSelectedAgent(agent);
    // Agent switch logic - may need to clear messages or start new thread
  }, []);

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-void-surface",
        className
      )}
      data-app="chat"
    >
      {/* Thread Sidebar (left) */}
      {showThreads && (
        <ThreadSidebar
          className="w-64 flex-shrink-0 border-white/5 border-r"
          onClose={() => setShowThreads(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
          <div className="flex items-center gap-2">
            <Button
              className="h-7 w-7"
              onClick={() => setShowThreads(!showThreads)}
              size="icon"
              variant="ghost"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <AgentSelector onChange={handleAgentChange} value={selectedAgent} />
          </div>

          <div className="flex items-center gap-2">
            <VoiceIndicator
              isActive={isRecording}
              status={status as "idle" | "streaming" | "error"}
            />
            <Button
              className="h-7 w-7"
              onClick={() => setShowContext(!showContext)}
              size="icon"
              variant="ghost"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message List (virtualized) */}
        <MessageList
          className="flex-1"
          messages={messages}
          onEdit={handleEdit}
          onRegenerate={handleRegenerate}
          status={status as "idle" | "streaming" | "error"}
        />

        {/* Input Area */}
        <InputArea
          disabled={status === "streaming"}
          error={error}
          isRecording={isRecording}
          onSubmit={handleSubmit}
          onVoiceToggle={toggleVoice}
        />
      </div>

      {/* Context Panel (right) */}
      {showContext && (
        <ContextPanel
          className="w-72 flex-shrink-0 border-white/5 border-l"
          messages={messages}
          onClose={() => setShowContext(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ChatAppWindow - Wrapped for use in desktop window system
 */
export function ChatAppWindow(props: WindowComponentProps) {
  return <ChatApp className="h-full" windowId={props.window.id} />;
}

export default ChatApp;
