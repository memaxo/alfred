import type { UIMessage } from "@alfred/type/stream";
import type { NodeProps } from "@xyflow/react";

import { MessageSquare, Mic } from "lucide-react";
import {
  useCallback,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Virtuoso } from "react-virtuoso";
import { toast } from "sonner";
import { z } from "zod";

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { renderPart } from "@/components/chat-render";
import { MessageActions } from "@/components/chat/message-actions";
import { Button } from "@/components/ui/button";
import { type AssistantPart, ChatMessage } from "@/components/ui/chat-message";
import { Textarea } from "@/components/ui/textarea";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { useMessageEdit } from "@/hooks/use-message-edit";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useDesktopStore } from "@/store/desktop";

type AssistantUIMessage = UIMessage;

const chatWindowDataSchema = z.object({
  type: z.literal("chat"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  resourceRef: z
    .object({
      type: z.literal("thread"),
      id: z.string(),
    })
    .optional(),
  messages: z.array(z.unknown()).optional(),
  error: z.string().optional(),
});

interface ChatWindowMessageItemProps {
  editText: string;
  isEditing: boolean;
  message: AssistantUIMessage;
  onCancel: () => void;
  onEditTextChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onEditTextKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
  renderActions: (message: AssistantUIMessage) => JSX.Element;
}

function ChatWindowMessageItem({
  editText,
  isEditing,
  message,
  onCancel,
  onEditTextChange,
  onEditTextKeyDown,
  onSave,
  renderActions,
}: ChatWindowMessageItemProps) {
  if (isEditing) {
    return (
      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <Textarea
          autoFocus
          className="min-h-[80px] border-white/10 bg-transparent text-sm"
          onChange={onEditTextChange}
          onKeyDown={onEditTextKeyDown}
          placeholder="Edit your message..."
          value={editText}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} size="sm" variant="ghost">
            Cancel
          </Button>
          <Button disabled={!editText.trim()} onClick={onSave} size="sm">
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ChatMessage
        actions={renderActions(message)}
        content={message.parts as AssistantPart[]}
        renderPart={renderPart}
        role={message.role as AssistantUIMessage["role"]}
      />
    </div>
  );
}

export function ChatWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = chatWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "chat" as const, viewMode: "full" as const };

  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);

  const {
    messages,
    handleSend: sendToChat,
    handleRegenerate,
    handleEdit,
    isRecording,
    toggleVoice,
    status,
    error,
    conversationId,
  } = useChatLogic({ initialAgent: "assistant" });

  const {
    editText,
    isEditing,
    setEditText,
    startEditing,
    cancelEditing,
    saveEdit,
  } = useMessageEdit({ handleEdit });

  const { queueMessage, pendingMessages, retryAll } = useOfflineQueue();

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
      sendToChat(text);
    },
    [conversationId, queueMessage, sendToChat]
  );

  const handleRegenerateMessage = useCallback(
    (_message: AssistantUIMessage) => {
      handleRegenerate();
    },
    [handleRegenerate]
  );

  const renderMessageActions = useCallback(
    (message: AssistantUIMessage) => {
      const isAssistant = message.role === "assistant";
      const isUser = message.role === "user";
      const allowRegenerate = isAssistant && messages.at(-1)?.id === message.id;

      return (
        <MessageActions
          disabled={status === "streaming"}
          message={message}
          onEdit={isUser ? startEditing : undefined}
          onRegenerate={allowRegenerate ? handleRegenerateMessage : undefined}
          role={message.role as AssistantUIMessage["role"]}
        />
      );
    },
    [status, startEditing, messages, handleRegenerateMessage]
  );

  useEffect(() => {
    if (error && windowData.error !== error.message) {
      updateWindowData(id, { draft: { error: error.message } });
    }
  }, [error, id, updateWindowData, windowData.error]);

  useEffect(() => {
    const handleOnline = () => {
      if (pendingMessages.length > 0) {
        const messagesToRetry = retryAll();
        for (const message of messagesToRetry) {
          sendToChat(message.content);
        }
        if (messagesToRetry.length > 0) {
          toast.success(`Sent ${messagesToRetry.length} queued messages`);
        }
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [pendingMessages, retryAll, sendToChat]);

  const handleEditChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setEditText(event.target.value);
    },
    [setEditText]
  );

  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
      }
    },
    [cancelEditing]
  );

  const renderItem = useCallback(
    (_index: number, message: AssistantUIMessage) => {
      const isEditingCurrent = isEditing(message.id);
      return (
        <ChatWindowMessageItem
          editText={editText}
          isEditing={isEditingCurrent}
          message={message}
          onCancel={cancelEditing}
          onEditTextChange={handleEditChange}
          onEditTextKeyDown={handleEditKeyDown}
          onSave={saveEdit}
          renderActions={renderMessageActions}
        />
      );
    },
    [
      cancelEditing,
      editText,
      handleEditChange,
      handleEditKeyDown,
      isEditing,
      renderMessageActions,
      saveEdit,
    ]
  );

  const handleSubmit = useCallback(
    (input: { text: string }) => {
      if (!navigator.onLine) {
        handleSendWithQueue(input.text);
        return;
      }
      if (input.text.startsWith("/workflow ")) {
        spawnWindow("workflow");
      }
      handleSendWithQueue(input.text);
    },
    [handleSendWithQueue, spawnWindow]
  );

  if (import.meta.env.VITE_TEST_MODE === "true") {
    return (
      <WindowFrame
        actions={<MessageSquare className="h-4 w-4 text-purple-400" />}
        id={id}
        selected={selected}
        title="Neural Stream"
        width={500}
        windowType="chat"
      >
        <div className="p-4 text-biolum">Chat disabled in test environment</div>
      </WindowFrame>
    );
  }

  if (lod === "tiny") {
    return <TinyDot color="bg-purple-500" shadow="shadow-purple-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-purple-500/20"
        hoverColor="hover:border-purple-500/40"
        icon={<MessageSquare className="h-3 w-3" />}
        label="Neural Stream"
        textColor="text-purple-500"
      />
    );
  }

  return (
    <WindowFrame
      actions={<MessageSquare className="h-4 w-4 text-purple-400" />}
      id={id}
      selected={selected}
      title={windowData.label ?? "Neural Stream"}
      width={500}
      windowType="chat"
    >
      <div className="flex h-[550px] flex-col">
        <div className="flex-1 overflow-hidden">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-biolum-faint text-sm">
              Start a conversation...
            </p>
          ) : (
            <Virtuoso
              data={messages}
              itemContent={renderItem}
              followOutput="auto"
            />
          )}
        </div>
        <div className="border-white/10 border-t p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea placeholder="Type a message..." />
            <PromptInputFooter>
              <Button
                className={isRecording ? "text-red-400" : ""}
                onClick={toggleVoice}
                size="icon"
                variant="ghost"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <PromptInputSubmit />
            </PromptInputFooter>
          </PromptInput>
        </div>
        {error && (
          <div className="bg-red-500/10 px-3 py-2 text-red-400 text-xs">
            {error.message}
          </div>
        )}
      </div>
    </WindowFrame>
  );
}
