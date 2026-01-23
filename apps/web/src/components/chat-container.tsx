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
import { MessageActions } from "@/components/chat/message-actions";
import {
  CognitiveFeedbackDialog,
  type CognitiveFeedbackDraft,
} from "@/components/cognitive-feedback/dialog";
import { ContextLens } from "@/components/shared/context-lens";
import { Button } from "@/components/ui/button";
import { type AssistantPart, ChatMessage } from "@/components/ui/chat-message";
import { Textarea } from "@/components/ui/textarea";
import { useChatLogic } from "@/hooks/use-chat-logic";
import type { FeedbackSurface } from "@/hooks/use-cognitive-feedback";
import { useCognitiveFeedback } from "@/hooks/use-cognitive-feedback";
import { useFocusedContext } from "@/hooks/use-focused-context";
import { useMessageEdit } from "@/hooks/use-message-edit";
import { getMessageText } from "@/utils/message";
import { Actions } from "./actions";
import { createPartRenderer } from "./chat-render";
import { Connect } from "./connect";
import { Controls } from "./controls";
import { ErrorBoundary } from "./error-boundary";
import { Load } from "./load";
import { Queue } from "./queue";

export type ChatContainerProps = {
  agent?: "assistant" | "orchestrator";
  thread?: string;
  resource?: string;
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
};

export function ChatContainer({
  agent,
  thread: _thread,
  resource: _resource,
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
    activeActions,
    handleAgentChange,
    clear,
    handleEdit,
    handleRegenerate,
    conversationId,
    addToolApprovalResponse,
  } = useChatLogic({
    initialAgent: agent,
    initialMessages,
    initialConversationId,
  });
  const {
    editingMessageId,
    isEditing,
    editText,
    setEditText,
    startEditing,
    cancelEditing,
    saveEdit,
  } = useMessageEdit({ handleEdit });

  const [feedbackDraft, setFeedbackDraft] =
    useState<CognitiveFeedbackDraft | null>(null);
  const {
    submit: submitFeedback,
    status: feedbackStatus,
    error: feedbackError,
    reset: resetFeedback,
  } = useCognitiveFeedback();

  const focused = useFocusedContext();

  const partRenderer = useMemo(
    () =>
      createPartRenderer(
        {
          onAddToolApprovalResponse: addToolApprovalResponse,
        },
        conversationId
      ),
    [addToolApprovalResponse, conversationId]
  );

  const queueItems = useMemo(
    () =>
      activeActions.map((action) => ({
        id: action.id,
        title: action.name,
        priority:
          action.status === "running" ? ("high" as const) : ("medium" as const),
      })),
    [activeActions]
  );

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
      const isAssistant = message.role === "assistant";
      const isUser = message.role === "user";

      return (
        <MessageActions
          disabled={status === "streaming" || feedbackStatus === "pending"}
          onEdit={
            isUser
              ? () => startEditing(message as AssistantUIMessage)
              : undefined
          }
          onNegative={
            isAssistant
              ? () =>
                  handleFeedbackIntent(
                    message as AssistantUIMessage,
                    "negative"
                  )
              : undefined
          }
          onPositive={
            isAssistant
              ? () =>
                  handleFeedbackIntent(
                    message as AssistantUIMessage,
                    "positive"
                  )
              : undefined
          }
          onRegenerate={
            isAssistant && messages.at(-1)?.id === message.id
              ? handleRegenerate
              : undefined
          }
          role={message.role as AssistantUIMessage["role"]}
        />
      );
    },
    [
      status,
      feedbackStatus,
      startEditing,
      handleFeedbackIntent,
      messages,
      handleRegenerate,
      isEditing,
    ]
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
    async (values: {
      expected: string;
      actual: string;
      surface?: FeedbackSurface;
    }) => {
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

  const renderMessage = useCallback(
    (_index: number, message: UIMessage) => {
      const isEditing = editingMessageId === message.id;

      if (isEditing) {
        return (
          <div className="mx-4 mb-4 flex flex-col gap-2 rounded-lg border bg-secondary/20 p-4">
            <Textarea
              autoFocus
              className="min-h-[100px] bg-background"
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Edit your message..."
              value={editText}
            />
            <div className="flex justify-end gap-2">
              <Button onClick={cancelEditing} size="sm" variant="outline">
                Cancel
              </Button>
              <Button disabled={!editText.trim()} onClick={saveEdit} size="sm">
                Save & Regenerate
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="px-4">
          <ChatMessage
            actions={renderMessageActions(message)}
            content={message.parts as AssistantPart[]}
            renderPart={partRenderer}
            role={message.role as AssistantUIMessage["role"]}
          />
        </div>
      );
    },
    [
      editingMessageId,
      editText,
      cancelEditing,
      saveEdit,
      partRenderer,
      renderMessageActions,
    ]
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
                runtimeContext={
                  focused.content
                    ? {
                        nodeType: focused.nodeType,
                        contentPreview: focused.content.slice(0, 500),
                      }
                    : { nodeType: focused.nodeType }
                }
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
                itemContent={renderMessage}
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
                virtualized
                voiceDisabled={currentAgent !== "assistant"}
                voiceLabel={isRecording ? "Stop Recording" : "Voice"}
              />
            </div>
            {activeActions.length > 0 && (
              <div className="border-t lg:w-80 lg:border-t-0 lg:border-l xl:w-96">
                <div className="h-full overflow-auto p-4">
                  <Queue items={queueItems} />
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
