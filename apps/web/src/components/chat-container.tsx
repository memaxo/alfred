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

import type { AssistantUIMessage } from "@alfred/agent";
import { Chat } from "@alfred/ui";
import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { Actions } from "./actions";
import { createPartRenderer } from "./chat-render";
import { Connect } from "./connect";
import { Controls } from "./controls";
import { ErrorBoundary } from "./error-boundary";
import { Load } from "./load";
import { useFocusedContext } from "@/hooks/use-focused-context";
import { ContextLens } from "@/components/mindscape/context-lens";

export function ChatContainer({
  agent,
  thread,
  resource,
  initialMessages,
  initialConversationId,
}: ChatContainerProps) {
  const {
    messages,
    actions,
    status,
    handleSend,
    toggleVoice,
    isRecording,
    error,
    voiceError,
    currentAgent,
    showActionsPanel,
    activeActions,
  } = useChatLogic({
    initialAgent: agent,
    initialMessages,
    initialConversationId,
  });

  const focused = useFocusedContext();

  const partRenderer = useMemo(() => createPartRenderer(), []);

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-4">
            <Connect status={status} />
            <Controls
              agent={currentAgent}
              resource={resource}
              thread={thread}
            />
          </div>
          <div className="flex items-center gap-4">
              {focused.label && (
                <ContextLens
                  label={focused.label}
                  ragDocuments={focused.ragDocuments}
                  isLoading={focused.isLoading}
                  isError={focused.isError}
                />
              )}
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
                onVoice={toggleVoice}
                perf
                placeholder={
                  currentAgent === "assistant"
                    ? focused.label ? `Ask about ${focused.label}...` : "Ask Alfred how to help…"
                    : "Switch to the assistant agent to chat."
                }
                renderPart={partRenderer}
                virtualized
                voiceDisabled={currentAgent !== "assistant"}
                voiceLabel={isRecording ? "Stop Recording" : "Voice"}
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
        {voiceError && (
          <div className="border-t bg-destructive/10 p-4">
            <p className="text-destructive text-sm">
              Voice Error: {voiceError.message}
            </p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
