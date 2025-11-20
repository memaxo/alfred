import type { UIMessage } from "@alfred/type/stream";
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
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useMindscapeExecutor } from "@/hooks/use-mindscape-executor";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { useMindscapeStore } from "@/store/mindscape";
import { MindscapeNode } from "./mindscape-node";

export function ChatNode({ id, data, selected }: NodeProps) {
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const { startWorkflow } = useMindscapeExecutor();

  const { messages, send, hydrate } = useAssistantStream({
    onError: (err) => {
      // Log error without console
      updateArtifactData(id, { error: err.message });
    },
  });

  // Hydrate from data on mount
  useEffect(() => {
    const storedMessages = data?.messages;
    if (
      storedMessages &&
      Array.isArray(storedMessages) &&
      messages.length === 0
    ) {
      hydrate(storedMessages as UIMessage[]);
    }
  }, [data, messages.length, hydrate]); // Add dependencies

  // Sync back to data on change
  useEffect(() => {
    if (messages.length > 0) {
      updateArtifactData(id, { messages });
    }
  }, [messages, id, updateArtifactData]);

  const handleSend = useCallback(
    (input: { text: string }) => {
      // Check for commands
      if (input.text.startsWith("/workflow ")) {
        const requirement = input.text.replace("/workflow ", "");
        startWorkflow(requirement);
        // Add a fake user message to chat for continuity
        // Actually send() will do that but we might want to intercept
        // For now let's just send it so it appears in history
      }
      send(input.text);
    },
    [send, startWorkflow]
  );

  const { isRecording, startRecording, stopRecording } = useVoiceCapture({
    onTranscript: (text) => {
      if (text.trim().length > 0) {
        send(text);
      }
    },
  });

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
          <PromptInput onSubmit={handleSend}>
            <PromptInputTextarea
              className="min-h-[60px] border-white/10 bg-void-surface/50 text-biolum placeholder:text-biolum-faint/50"
              placeholder="Interrogate the void... (/workflow to start)"
            />
            <PromptInputFooter>
              <Button
                className={`h-8 w-8 ${isRecording ? "animate-pulse text-red-500" : "text-biolum-dim hover:text-biolum"}`}
                onClick={isRecording ? stopRecording : startRecording}
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
