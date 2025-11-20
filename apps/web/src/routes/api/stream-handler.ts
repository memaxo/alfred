import { type buildAssistantTools, getModelId, getOpenAI } from "@alfred/agent";
import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import { conversationRepo } from "@alfred/db";
import { auth } from "@alfred/auth";
import { logger } from "@alfred/api/utils/logger";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import {
  consumeStream,
  convertToModelMessages,
  generateId,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

const requestSchema = z
  .object({
    messages: z.array(uiMessageSchema).optional(),
    conversationId: z.string().min(1).optional(),
  })
  .passthrough();

type BuildToolsFn = () => ReturnType<typeof buildAssistantTools>;

export async function handleStreamRequest(
  request: Request,
  buildTools: BuildToolsFn,
  errorPrefix: string
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await request.json();
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          issues: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const messages = (parsed.data.messages ?? []) as UIMessage[];
    const persistedMessageIds = new Set<string>();

    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id ?? null;

    let conversationId =
      typeof parsed.data.conversationId === "string"
        ? parsed.data.conversationId
        : undefined;

    if (userId && !conversationId) {
      const conversation = await conversationRepo.createConversation(userId);
      conversationId = conversation.id;
    }

    if (userId && conversationId) {
      await persistMessages({
        conversationId,
        userId,
        messages,
        existingMessageIds: persistedMessageIds,
      });
    }

    let preferencePrompt: string | undefined;
    const tools = buildTools();

    if (userId) {
      try {
        const prompt = await buildPreferenceSystemPrompt(userId, {
          conversationType: errorPrefix === "assistant" ? "assistant" : "chat",
          toolNames: tools ? Object.keys(tools) : undefined,
        });
        preferencePrompt = prompt || undefined;
      } catch (error) {
        logger.warn(`${errorPrefix}_preference_prompt_failed`, {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const model = getOpenAI().chat(getModelId());
    const result = streamText({
      model,
      messages: convertToModelMessages(messages),
      tools,
      abortSignal: request.signal,
      system: preferencePrompt,
      onAbort: ({ steps }) => {
        logger.warn(`${errorPrefix}_stream_aborted`, {
          steps: steps.length,
        });
      },
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      consumeSseStream: consumeStream,
      onFinish: async ({ isAborted, messages: streamedMessages }) => {
        if (isAborted) {
          logger.warn(`${errorPrefix}_stream_aborted_on_finish`);
          return;
        }

        if (!userId || !conversationId || !streamedMessages?.length) {
          return;
        }

        await persistMessages({
          conversationId,
          userId,
          messages: streamedMessages,
          existingMessageIds: persistedMessageIds,
        });
      },
    });

    if (conversationId) {
      response.headers.set("x-conversation-id", conversationId);
    }

    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(`${errorPrefix}_stream_error`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: `${errorPrefix}_stream_failed` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

type PersistPayload = {
  userId: string;
  conversationId: string;
  messages: UIMessage[];
  existingMessageIds: Set<string>;
};

async function persistMessages({
  userId,
  conversationId,
  messages,
  existingMessageIds,
}: PersistPayload) {
  for (const message of messages) {
    if (!message.id || existingMessageIds.has(message.id)) {
      continue;
    }
    try {
      await conversationRepo.createMessage(userId, conversationId, message);
    } catch (error) {
      logger.warn("conversation_message_persist_failed", {
        conversationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    existingMessageIds.add(message.id);
  }
}
