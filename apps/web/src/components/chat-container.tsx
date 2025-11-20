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
import { Virtuoso } from "react-virtuoso";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { Actions } from "./actions";
import { renderPart } from "./chat-render";
import { Connect } from "./connect";
import { Controls } from "./controls";
import { ErrorBoundary } from "./error-boundary";
import { Load } from "./load";

type ChatContainerProps = {
  agent: "assistant" | "orchestrator";
  thread?: string;
  resource?: string;
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
};

export function ChatContainer({
  agent,
  initialMessages,
  initialConversationId,
}: ChatContainerProps) {
  const {
    currentAgent,
    messages,
    actions,
    activeActions,
    status,
    error,
    voiceError,
    isRecording,
    handleSend,
    handleAgentChange,
    toggleVoice,
    clear,
  } = useChatLogic({
    initialAgent: agent,
    initialMessages,
    initialConversationId,
  });

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
                onVoice={toggleVoice}
                perf
                placeholder={
                  currentAgent === "assistant"
                    ? "Ask Alfred how to help…"
                    : "Switch to the assistant agent to chat."
                }
                renderPart={renderPart}
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
