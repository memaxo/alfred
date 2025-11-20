import type { AssistantUIMessage } from "@alfred/agent";
import type { NodeProps } from "@xyflow/react";
import { Mic } from "lucide-react";
import { useCallback, useEffect } from "react";
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
import { useChatLogic } from "@/hooks/use-chat-logic";
import { useMindscapeExecutor } from "@/hooks/use-mindscape-executor";
import { chatNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore } from "@/store/mindscape";
import { MindscapeNode } from "./mindscape-node";

export function ChatNode({ id, data, selected }: NodeProps) {
  // Validate and parse node data
  const result = chatNodeDataSchema.safeParse(data);
  const validatedData = result.success ? result.data : { messages: undefined, error: undefined };
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const { startWorkflow } = useMindscapeExecutor();

  const {
    messages,
    handleSend: sendToChat,
    hydrate,
    isRecording,
    toggleVoice,
    error,
  } = useChatLogic({ initialAgent: "assistant" });

  // Log errors to node data
  useEffect(() => {
    if (error) {
      updateArtifactData(id, { error: error.message, type: "chat" });
    }
  }, [error, id, updateArtifactData]);

  // Hydrate from data on mount
  useEffect(() => {
    const storedMessages = validatedData.messages;
    if (
      storedMessages &&
      Array.isArray(storedMessages) &&
      messages.length === 0
    ) {
      hydrate(storedMessages as AssistantUIMessage[]);
    }
  }, [validatedData.messages, messages.length, hydrate]);

  // Sync back to data on change
  useEffect(() => {
    if (messages.length > 0) {
      updateArtifactData(id, { messages, type: "chat" });
    }
  }, [messages, id, updateArtifactData]);

  const handleSubmit = useCallback(
    (input: { text: string }) => {
      // Check for commands
      if (input.text.startsWith("/workflow ")) {
        const requirement = input.text.replace("/workflow ", "");
        startWorkflow(requirement);
        // We still send it to chat for history
      }
      sendToChat(input.text);
    },
    [sendToChat, startWorkflow]
  );

  return (
    <MindscapeNode
      className="flex h-[600px] w-[500px] flex-col"
      id={id}
      selected={selected}
      title="Neural Stream"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="gap-4">
            {messages.map((msg) => (
              <ChatMessage
                content={msg.parts}
                key={msg.id}
                renderPart={renderPart}
                role={msg.role}
              />
            ))}
          </ConversationContent>
        </Conversation>

        <div className="mt-auto border-white/10 border-t bg-void-surface/50 p-4 backdrop-blur-md">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              className="min-h-[60px] border-white/10 bg-void-surface/50 text-biolum placeholder:text-biolum-faint/50"
              placeholder="Interrogate the void... (/workflow to start)"
            />
            <PromptInputFooter>
              <Button
                className={`h-8 w-8 ${isRecording ? "animate-pulse text-red-500" : "text-biolum-dim hover:text-biolum"}`}
                onClick={toggleVoice}
                size="icon"
                variant="ghost"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <PromptInputSubmit className="bg-biolum text-void hover:bg-biolum/90" />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </MindscapeNode>
  );
}
