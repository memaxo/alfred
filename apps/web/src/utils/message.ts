import type { UIMessage as AssistantUIMessage } from "@alfred/type/stream";

export const getMessageText = (message: AssistantUIMessage): string =>
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
