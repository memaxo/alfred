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
import { Actions } from "./actions";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useCallback, useMemo, useState } from "react";

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

  const activeActions = useMemo(
    () => actions.filter(action => action.status === "pending" || action.status === "running"),
    [actions],
  );

  const handleSend = useCallback(
    (input: string) => {
      if (currentAgent !== "assistant") {
        console.warn("Streaming for the orchestrator agent is not yet enabled.");
        return;
      }
      send(input);
    },
    [currentAgent, send],
  );

  const showActionsPanel = actions.length > 0;
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
            {activeActions.length > 0 && (
              <Load
                message={
                  activeActions.length === 1
                    ? "Running 1 action"
                    : `Running ${activeActions.length} actions`
                }
              />
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col lg:flex-row">
            <div className="flex-1 overflow-hidden">
              <Chat
                messages={messages}
                onSend={handleSend}
                placeholder={
                  currentAgent === "assistant"
                    ? "Ask Alfred how to help…"
                    : "Switch to the assistant agent to chat."
                }
                onVoice={() => {
                  console.log("Voice input not yet implemented");
                }}
              />
            </div>
            {showActionsPanel && (
              <div className="border-t lg:border-l lg:border-t-0 lg:w-80 xl:w-96">
                <div className="h-full overflow-auto p-4">
                  <Actions actions={actions} />
                </div>
              </div>
            )}
          </div>
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
