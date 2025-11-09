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

import type { UIMessage } from "@alfred/type/stream";
import { Chat } from "@alfred/ui";
import { useCallback, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { Actions } from "./actions";
import { Connect } from "./connect";
import { Controls } from "./controls";
import { ErrorBoundary } from "./error-boundary";
import { Load } from "./load";

interface ChatContainerProps {
  agent: "assistant" | "orchestrator";
  thread?: string;
  resource?: string;
}

export function ChatContainer({ agent }: ChatContainerProps) {
  const [currentAgent, setCurrentAgent] = useState<
    "assistant" | "orchestrator"
  >(agent);
  const contextsRef = useRef<Map<string, UIMessage[]>>(new Map());

  const { messages, actions, status, error, send, clear, hydrate } =
    useAssistantStream({
      onError: (err) => {
        // Error is already displayed in the error state
        // Additional logging handled by error boundaries
      },
    });

  const activeActions = useMemo(
    () =>
      actions.filter(
        (action) => action.status === "pending" || action.status === "running"
      ),
    [actions]
  );

  const handleSend = useCallback(
    (input: string) => {
      if (currentAgent !== "assistant") {
        // Orchestrator streaming disabled: Use /orchestrator/run route for workflow execution.
        // This chat interface is for assistant conversations only.
        return;
      }
      send(input);
    },
    [currentAgent, send]
  );

  const handleAgentChange = useCallback(
    (nextAgent: "assistant" | "orchestrator") => {
      if (nextAgent === currentAgent) return;
      contextsRef.current.set(currentAgent, messages);
      clear();
      setCurrentAgent(nextAgent);
      const snapshot = contextsRef.current.get(nextAgent);
      if (snapshot) {
        hydrate(snapshot);
      }
    },
    [clear, currentAgent, hydrate, messages]
  );

  const showActionsPanel = actions.length > 0;
  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col">
        {/* Controls */}
        <div className="space-y-2 border-b p-4">
          <Controls
            agent={currentAgent}
            onAgentChange={handleAgentChange}
            onClear={clear}
          />
          <div className="flex items-center justify-between">
            <Connect agent={currentAgent} status={status} />
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
                disabled={currentAgent !== "assistant"}
                ListComponent={Virtuoso}
                messages={messages}
                onSend={handleSend}
                onVoice={() => {
                  // Voice input not yet implemented
                }}
                perf
                placeholder={
                  currentAgent === "assistant"
                    ? "Ask Alfred how to help…"
                    : "Switch to the assistant agent to chat."
                }
                virtualized
              />
            </div>
            {showActionsPanel && (
              <div className="border-t lg:w-80 lg:border-t-0 lg:border-l xl:w-96">
                <div className="h-full overflow-auto p-4">
                  <Actions actions={actions} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="border-t bg-destructive/10 p-4">
            <p className="text-destructive text-sm">Error: {error.message}</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
