import type { AssistantUIMessage } from "@alfred/agent";
import type { UIMessagePart } from "@alfred/type/stream";
import { Message as BaseMessage, MessageAvatar, MessageContent } from "@/components/ui/message";
import type { ReactNode } from "react";

type AssistantPart = AssistantUIMessage["parts"][number];

export function ChatMessage({
  role,
  content,
  renderPart,
}: {
  role: AssistantUIMessage["role"] | "user";
  content: string | AssistantPart[];
  renderPart?: (part: AssistantPart, message: AssistantUIMessage) => ReactNode;
}) {
  if (role === "data" || role === "system") return null;

  return (
    <BaseMessage from={role === "assistant" ? "assistant" : "user"}>
      {role === "assistant" && <MessageAvatar src="/alfred.png" name="AL" />}
      <MessageContent variant={role === "user" ? "contained" : "flat"}>
        {Array.isArray(content) 
          ? content.map((part, i) => (
              <div key={i}>
                {renderPart
                  ? renderPart(part, {
                      id: "temp",
                      role: role as AssistantUIMessage["role"],
                      parts: content,
                    })
                  : JSON.stringify(part)}
              </div>
            ))
          : content}
      </MessageContent>
      {role === "user" && <MessageAvatar src="/user.png" name="ME" />}
    </BaseMessage>
  );
}
