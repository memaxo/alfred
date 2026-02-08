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
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  type FeedbackSurface,
  useCognitiveFeedback,
} from "@/hooks/use-cognitive-feedback";
import { useFocusedContext } from "@/hooks/use-focused-context";
import { useMessageEdit } from "@/hooks/use-message-edit";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { getMessageText } from "@/utils/message";

import { Actions } from "./actions";
import { createPartRenderer } from "./chat-render";
import { Connect } from "./connect";
import { Controls } from "./controls";
import { ErrorBoundary } from "./error-boundary";
import { Load } from "./load";
import { Queue } from "./queue";

type AssistantUIMessage = UIMessage;

export interface ChatContainerProps {
  agent?: "assistant" | "orchestrator";
  thread?: string;
  resource?: string;
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
}

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

  const { queueMessage, pendingMessages, retryAll, removeFromQueue } =
    useOfflineQueue();

  // Handle sending with offline queue support
  const handleSendWithQueue = useCallback(
    (text: string) => {
      if (!navigator.onLine) {
        const queued = queueMessage(text, conversationId ?? undefined);
        if (queued) {
          toast.info("Message queued - will send when online");
        } else {
          toast.error("Unable to queue message");
        }
        return;
      }
      handleSend(text);
    },
    [conversationId, queueMessage, handleSend]
  );

  // Retry queued messages when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (pendingMessages.length > 0) {
        const messagesToRetry = retryAll();
        for (const message of messagesToRetry) {
          handleSend(message.content);
        }
        if (messagesToRetry.length > 0) {
          toast.success(`Sent ${messagesToRetry.length} queued messages`);
        }
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [pendingMessages, retryAll, handleSend]);

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

  const handleEditMessage = useCallback(
    (message: AssistantUIMessage) => {
      startEditing(message);
    },
    [startEditing]
  );

  const handleFeedbackNegative = useCallback(
    (message: AssistantUIMessage) => {
      handleFeedbackIntent(message, "negative");
    },
    [handleFeedbackIntent]
  );

  const handleFeedbackPositive = useCallback(
    (message: AssistantUIMessage) => {
      handleFeedbackIntent(message, "positive");
    },
    [handleFeedbackIntent]
  );

  const handleRegenerateMessage = useCallback(
    (_message: AssistantUIMessage) => {
      handleRegenerate();
    },
    [handleRegenerate]
  );

  const renderMessageActions = useCallback(
    (message: UIMessage) => {
      const isAssistant = message.role === "assistant";
      const isUser = message.role === "user";
      const allowRegenerate = isAssistant && messages.at(-1)?.id === message.id;

      return (
        <MessageActions
          disabled={status === "streaming" || feedbackStatus === "pending"}
          message={message as AssistantUIMessage}
          onEdit={isUser ? handleEditMessage : undefined}
          onNegative={isAssistant ? handleFeedbackNegative : undefined}
          onPositive={isAssistant ? handleFeedbackPositive : undefined}
          onRegenerate={allowRegenerate ? handleRegenerateMessage : undefined}
          role={message.role as AssistantUIMessage["role"]}
        />
      );
    },
    [
      status,
      feedbackStatus,
      messages,
      handleEditMessage,
      handleFeedbackNegative,
      handleFeedbackPositive,
      handleRegenerateMessage,
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

  const handleEditChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditText(event.target.value);
    },
    [setEditText]
  );

  const handleEditKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        saveEdit();
      }
    },
    [cancelEditing, saveEdit]
  );

  const chatPlaceholder = useMemo(() => {
    if (currentAgent === "assistant") {
      return focused.label
        ? `Ask about ${focused.label}...`
        : "Ask Alfred how to help…";
    }
    return focused.label
      ? `Ask the orchestrator about ${focused.label}...`
      : "Ask the orchestrator to plan or coordinate…";
  }, [currentAgent, focused.label]);

  const handleRetryQueued = useCallback(() => {
    for (const message of pendingMessages) {
      handleSend(message.content);
      removeFromQueue(message.id);
    }
  }, [pendingMessages, handleSend, removeFromQueue]);

  const renderMessage = useCallback(
    (_index: number, message: UIMessage) => {
      const isEditing = editingMessageId === message.id;

      if (isEditing) {
        return (
          <div className="mx-4 mb-4 flex flex-col gap-2 rounded-lg border bg-secondary/20 p-4">
            <Textarea
              autoFocus
              className="min-h-[100px] bg-background"
              onChange={handleEditChange}
              onKeyDown={handleEditKeyDown}
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
      handleEditChange,
      handleEditKeyDown,
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
                disabled={status === "streaming"}
                itemContent={renderMessage}
                ListComponent={Virtuoso}
                messages={messages}
                onSend={handleSendWithQueue}
                onVoice={toggleVoice}
                perf
                placeholder={chatPlaceholder}
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

        {/* Offline queue indicator */}
        {pendingMessages.length > 0 && (
          <div className="border-t bg-yellow-500/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-yellow-600 text-sm">
                {pendingMessages.length} message
                {pendingMessages.length === 1 ? "" : "s"} queued (offline)
              </p>
              <Button onClick={handleRetryQueued} size="sm" variant="outline">
                Retry Now
              </Button>
            </div>
          </div>
        )}

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
    const { streamId } = metadata as Record<string, unknown>;
    if (typeof streamId === "string" && streamId.length > 0) {
      return streamId;
    }
  }
  return typeof message.id === "string" ? message.id : undefined;
};
