import type { AssistantUIMessage } from "@alfred/agent";
import type { NodeProps } from "@xyflow/react";
import { MessageSquare, Mic } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { renderPart } from "@/components/chat-render";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/ui/chat-message";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useChatLogic } from "@/hooks/use-chat-logic";
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

  const updateWindow = useDesktopStore((s) => s.updateWindow);
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);

  const {
    messages,
    handleSend: sendToChat,
    hydrate,
    isRecording,
    toggleVoice,
    error,
  } = useChatLogic({ initialAgent: "assistant" });

  useEffect(() => {
    if (error && windowData.error !== error.message) {
      updateWindow(id, { draft: { error: error.message } });
    }
  }, [error, id, updateWindow, windowData.error]);

  useEffect(() => {
    const storedMessages = windowData.messages;
    if (
      storedMessages &&
      Array.isArray(storedMessages) &&
      storedMessages.length > 0 &&
      messages.length === 0
    ) {
      hydrate(storedMessages as AssistantUIMessage[]);
    }
  }, [windowData.messages, messages.length, hydrate]);

  const lastMessagesRef = useRef<string>("");
  useEffect(() => {
    if (messages.length > 0) {
      const key = JSON.stringify(messages.map((m) => m.id));
      if (key === lastMessagesRef.current) {
        return;
      }
      lastMessagesRef.current = key;
      updateWindow(id, { draft: { messages } });
    }
  }, [messages, id, updateWindow]);

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
        <Conversation>
          <ConversationContent className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-biolum-faint text-sm">
                Start a conversation...
              </p>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  content={message.parts}
                  key={message.id}
                  renderPart={renderPart}
                  role={message.role}
                />
              ))
            )}
          </ConversationContent>
        </Conversation>
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
