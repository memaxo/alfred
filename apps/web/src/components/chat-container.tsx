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
import type { UIMessage } from "@alfred/type/stream";
import { Chat } from "@alfred/ui";
import { useCallback, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { toast } from "sonner";
import { CognitiveFeedbackControls } from "@/components/cognitive-feedback/controls";
import {
  CognitiveFeedbackDialog,
  type CognitiveFeedbackDraft,
} from "@/components/cognitive-feedback/dialog";
import { ContextLens } from "@/components/mindscape/context-lens";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { useCognitiveFeedback } from "@/hooks/use-cognitive-feedback";
import { useFocusedContext } from "@/hooks/use-focused-context";
import { Actions } from "./actions";
import { createPartRenderer } from "./chat-render";
import { Connect } from "./connect";
import { Controls } from "./controls";
import { ErrorBoundary } from "./error-boundary";
import { Load } from "./load";

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
    handleAgentChange,
    clear,
  } = useChatLogic({
    initialAgent: agent,
    initialMessages,
    initialConversationId,
  });
  const [feedbackDraft, setFeedbackDraft] =
    useState<CognitiveFeedbackDraft | null>(null);
  const {
    submit: submitFeedback,
    status: feedbackStatus,
    error: feedbackError,
    reset: resetFeedback,
  } = useCognitiveFeedback();

  const focused = useFocusedContext();

  const partRenderer = useMemo(() => createPartRenderer(), []);

  const handleFeedbackIntent = useCallback(
    (message: AssistantUIMessage, intent: "positive" | "negative") => {
      const streamId =
        getStreamId(message) ?? `message-${message.id ?? Date.now()}`;
      const text = getMessageText(message) || "Assistant response";
      setFeedbackDraft({
        streamId,
        expected: text,
        actual: "",
        intent,
        surface: "chat",
      });
    },
    []
  );

  const renderMessageActions = useCallback(
    (message: UIMessage) => {
      if (message.role !== "assistant") {
        return null;
      }
      return (
        <CognitiveFeedbackControls
          disabled={feedbackStatus === "pending"}
          onNegative={() =>
            handleFeedbackIntent(message as AssistantUIMessage, "negative")
          }
          onPositive={() =>
            handleFeedbackIntent(message as AssistantUIMessage, "positive")
          }
        />
      );
    },
    [feedbackStatus, handleFeedbackIntent]
  );

  const handleFeedbackClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setFeedbackDraft(null);
        resetFeedback();
      }
    },
    [resetFeedback]
  );

  const handleFeedbackSubmit = useCallback(
    async (values: { expected: string; actual: string; surface?: string }) => {
      if (!feedbackDraft) {
        return;
      }
      try {
        await submitFeedback({
          streamId: feedbackDraft.streamId,
          expected: values.expected,
          actual: values.actual,
          surface: values.surface ?? feedbackDraft.surface ?? "chat",
        });
        toast.success("Feedback recorded.");
        setFeedbackDraft(null);
        resetFeedback();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to submit feedback.";
        toast.error(message);
      }
    },
    [feedbackDraft, resetFeedback, submitFeedback]
  );

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-4">
            <Connect status={status} />
            <Controls
              agent={currentAgent}
              onAgentChange={handleAgentChange}
              onClear={clear}
            />
          </div>
          <div className="flex items-center gap-4">
            {focused.label && (
              <ContextLens
                contextSnapshot={focused.contextSnapshot}
                isError={focused.isError}
                isLoading={focused.isLoading}
                label={focused.label}
                ragDocuments={focused.ragDocuments}
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
                    ? focused.label
                      ? `Ask about ${focused.label}...`
                      : "Ask Alfred how to help…"
                    : "Switch to the assistant agent to chat."
                }
                renderMessageActions={renderMessageActions}
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
        <CognitiveFeedbackDialog
          draft={feedbackDraft}
          error={feedbackError}
          onOpenChange={handleFeedbackClose}
          onSubmit={handleFeedbackSubmit}
          status={feedbackStatus}
        />
      </div>
    </ErrorBoundary>
  );
}

const getStreamId = (message: AssistantUIMessage): string | undefined => {
  const metadata =
    message && typeof message === "object"
      ? ((message as { metadata?: Record<string, unknown> }).metadata ?? null)
      : null;
  if (metadata && typeof metadata === "object") {
    const streamId = (metadata as Record<string, unknown>).streamId;
    if (typeof streamId === "string" && streamId.length > 0) {
      return streamId;
    }
  }
  return typeof message.id === "string" ? message.id : undefined;
};

const getMessageText = (message: AssistantUIMessage): string =>
  message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }
      return null;
    })
    .filter((text): text is string => typeof text === "string")
    .join("\n")
    .trim();
