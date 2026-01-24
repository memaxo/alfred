import { type StreamChunk, type UIMessage } from "./sse";

export interface MLXChatOptions {
  baseUrl: string; // e.g., http://localhost:8000/v1
  apiKey?: string;
  model: string; // e.g., mlx-community/GLM-4.7-Flash-8bit-gs32
}

export async function* streamMLXChat(
  messages: UIMessage[],
  options: MLXChatOptions
): AsyncGenerator<StreamChunk> {
  const { baseUrl, apiKey, model } = options;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content ?? "",
      })),
      stream: true,
      temperature: 0.7,
    }),
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    method: "POST",
  });

  if (!response.ok) {
    yield { content: `MLX server error: ${response.status}`, type: "error" };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { content: "No response body", type: "error" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          continue;
        }

        const data = line.slice(6).trim();
        if (!data) {
          continue;
        }

        if (data === "[DONE]") {
          yield { type: "done" };
          return;
        }

        try {
          const parsed = JSON.parse(data) as any;
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield { content: delta, type: "text" };
          }
          const finish = parsed?.choices?.[0]?.finish_reason;
          if (finish) {
            yield { type: "done" };
            return;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  } catch (error) {
    yield {
      content: error instanceof Error ? error.message : String(error),
      type: "error",
    };
  } finally {
    reader.releaseLock();
  }
}
