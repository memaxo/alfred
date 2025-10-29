/**
 * Chat Container Component
 * 
 * Full integration example: Chat + Controls + Streaming
 * 
 * Carmack-Karpathy principles:
 * - Composition: multiple smaller components
 * - Error isolation: error boundary per tree
 * - Fast failure: clear error states
 */

import { ErrorBoundary } from "./error-boundary";
import { Chat } from "./chat";
import { Controls } from "./controls";
import { Connect } from "./connect";
import { Load } from "./load";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useState } from "react";

interface ChatContainerProps {
  agent: "assistant" | "orchestrator";
  thread?: string;
  resource?: string;
}

export function ChatContainer({ agent, thread, resource }: ChatContainerProps) {
  const [currentAgent, setCurrentAgent] = useState<"assistant" | "orchestrator">(agent);
  
  const {
    messages,
    actions,
    status,
    error,
    send,
    clear,
  } = useAssistantStream({
    thread,
    resource,
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full">
        {/* Controls */}
        <div className="p-4 border-b space-y-2">
          <Controls
            agent={currentAgent}
            onAgentChange={setCurrentAgent}
            onClear={clear}
          />
          <div className="flex items-center justify-between">
            <Connect status={status} agent={currentAgent} />
            {actions.length > 0 && (
              <Load message={`${actions.length} active actions`} />
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <Chat
            messages={messages}
            onSend={send}
            onVoice={() => {
              // TODO: Wire to voice capture
              console.log("Voice input not yet implemented");
            }}
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="p-4 border-t bg-destructive/10">
            <p className="text-sm text-destructive">
              Error: {error.message}
            </p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

