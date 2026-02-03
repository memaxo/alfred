import type { UIMessage } from "@alfred/type/stream";
import type { NodeProps } from "@xyflow/react";

type AssistantUIMessage = UIMessage;

import { MessageSquare, Mic } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
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
import { useDesktopStore } from "@/store/desktop";

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
  } = useChatLogic({ initialAgent: "assistant" });

  const {
    editText,
    isEditing,
    setEditText,
    startEditing,
    cancelEditing,
    saveEdit,
  } = useMessageEdit({ handleEdit });

  const renderMessageActions = useCallback(
    (message: AssistantUIMessage) => {
      const isAssistant = message.role === "assistant";
      const isUser = message.role === "user";

      return (
        <MessageActions
          disabled={status === "streaming"}
          onEdit={isUser ? () => startEditing(message) : undefined}
          onRegenerate={
            isAssistant && messages.at(-1)?.id === message.id
              ? handleRegenerate
              : undefined
          }
          role={message.role as AssistantUIMessage["role"]}
        />
      );
    },
    [status, startEditing, messages, handleRegenerate, isEditing]
  );

  useEffect(() => {
    if (error && windowData.error !== error.message) {
      updateWindowData(id, { draft: { error: error.message } });
    }
  }, [error, id, updateWindowData, windowData.error]);

  const handleSubmit = useCallback(
    (input: { text: string }) => {
      if (input.text.startsWith("/workflow ")) {
        spawnWindow("workflow");
      }
      sendToChat(input.text);
    },
    [sendToChat, spawnWindow]
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
              itemContent={(_index, message) => {
                const isEditingCurrent = isEditing(message.id);

                if (isEditingCurrent) {
                  return (
                    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                      <Textarea
                        autoFocus
                        className="min-h-[80px] border-white/10 bg-transparent text-sm"
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEditing();
                          }
                        }}
                        placeholder="Edit your message..."
                        value={editText}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={cancelEditing}
                          size="sm"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={!editText.trim()}
                          onClick={saveEdit}
                          size="sm"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-4">
                    <ChatMessage
                      actions={renderMessageActions(
                        message as AssistantUIMessage
                      )}
                      content={message.parts as AssistantPart[]}
                      renderPart={renderPart}
                      role={message.role as AssistantUIMessage["role"]}
                    />
                  </div>
                );
              }}
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
