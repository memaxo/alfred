import type { AssistantUIMessage } from "@alfred/agent";
import type { ReactNode } from "react";
import {
  Message as BaseMessage,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";

export type AssistantPart = AssistantUIMessage["parts"][number];

export function ChatMessage({
  role,
  content,
  renderPart,
  actions,
}: {
  role: AssistantUIMessage["role"] | "user";
  content: string | AssistantPart[];
  renderPart?: (part: AssistantPart, message: AssistantUIMessage) => ReactNode;
  actions?: ReactNode;
}) {
  if (role === "system") {
    return null;
  }

  return (
    <BaseMessage from={role === "assistant" ? "assistant" : "user"}>
      {role === "assistant" && <MessageAvatar name="AL" src="/alfred.png" />}
      <div className="flex flex-col gap-2">
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
        {actions && (
          <div
            className={cn(
              "flex",
              role === "assistant" ? "justify-start" : "justify-end"
            )}
          >
            {actions}
          </div>
        )}
      </div>
      {role === "user" && <MessageAvatar name="ME" src="/user.png" />}
    </BaseMessage>
  );
}
