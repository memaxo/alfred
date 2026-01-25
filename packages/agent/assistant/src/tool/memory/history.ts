/**
 * Memory History Tool
 *
 * Review past conversation history.
 * Allows the agent to look back at previous interactions.
 */

import {
  getConversationHistory,
  getConversations,
  getMessages,
  messageRowToUIMessage,
} from "@alfred/db/repo/conversation";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryToolCall,
} from "../../../../src/metrics";

const historyInputSchema = z.object({
  userId: z.string().min(1).describe("User ID to retrieve history for"),
  conversationId: z
    .string()
    .uuid()
    .optional()
    .describe("Specific conversation ID (omit for recent conversations)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of messages/conversations to return (default: 20)"),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Filter to conversations within N days"),
  search: z
    .string()
    .optional()
    .describe("Search term to filter messages (basic text match)"),
});

type HistoryInput = z.infer<typeof historyInputSchema>;

interface MessageSummary {
  id: string;
  role: string;
  preview: string;
  createdAt: string | null;
}

interface ConversationSummary {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessage: MessageSummary | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const toolMemoryHistory = {
  name: "memory_history",
  description:
    "Review past conversation history. Get recent conversations or messages from a specific conversation.",
  inputSchema: historyInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    conversation: z
      .object({
        id: z.string(),
        title: z.string().nullable(),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
      })
      .nullable(),
    messages: z
      .array(
        z.object({
          id: z.string(),
          role: z.string(),
          preview: z.string(),
          createdAt: z.string().nullable(),
        })
      )
      .optional(),
    conversations: z
      .array(
        z.object({
          id: z.string(),
          title: z.string().nullable(),
          messageCount: z.number(),
          lastMessage: z
            .object({
              id: z.string(),
              role: z.string(),
              preview: z.string(),
              createdAt: z.string().nullable(),
            })
            .nullable(),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
        })
      )
      .optional(),
    count: z.number(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: HistoryInput }) => {
    recordAssistantToolCall("memory_history");

    const limit = input.limit ?? 20;

    if (input.conversationId) {
      // Get specific conversation with messages
      const history = await getConversationHistory(
        input.conversationId,
        input.userId
      );

      if (!history) {
        return {
          success: false,
          conversation: null,
          count: 0,
          message: "Conversation not found",
        };
      }

      // Filter and format messages
      let filteredMessages = history.messages;

      if (input.search) {
        const searchLower = input.search.toLowerCase();
        filteredMessages = filteredMessages.filter((m) => {
          // Search in text parts
          for (const part of m.parts) {
            if (
              part.type === "text" &&
              part.text &&
              part.text.toLowerCase().includes(searchLower)
            ) {
              return true;
            }
          }
          return false;
        });
      }

      const messageSummaries: MessageSummary[] = filteredMessages
        .slice(-limit)
        .map((m) => {
          // Extract text preview from parts
          let preview = "";
          for (const part of m.parts) {
            if (part.type === "text" && part.text) {
              preview = part.text.slice(0, 200);
              break;
            }
          }

          return {
            id: m.id,
            role: m.role,
            preview: preview || "[non-text content]",
            createdAt: null, // Message row doesn't have created_at in UIMessage
          };
        });

      recordMemoryToolCall("memory_history", "success");

      return {
        success: true,
        conversation: {
          id: history.conversation.id,
          title: history.conversation.title,
          createdAt: history.conversation.created?.toISOString() ?? null,
          updatedAt: history.conversation.updated?.toISOString() ?? null,
        },
        messages: messageSummaries,
        count: messageSummaries.length,
        message: `Retrieved ${messageSummaries.length} messages`,
      };
    }

    // Get recent conversations
    const conversations = await getConversations(input.userId, {
      days: input.days,
      limit,
    });

    // Build summaries with last message
    const summaries: ConversationSummary[] = [];

    for (const conv of conversations) {
      const messages = await getMessages(conv.id, input.userId);

      let lastMessage: MessageSummary | null = null;
      if (messages.length > 0) {
        const last = messages.at(-1);
        if (last) {
          const uiMessage = messageRowToUIMessage(last);
          let preview = "";
          for (const part of uiMessage.parts) {
            if (part.type === "text" && part.text) {
              preview = part.text.slice(0, 100);
              break;
            }
          }

          lastMessage = {
            id: last.id,
            role: last.role,
            preview: preview || "[non-text content]",
            createdAt: last.created?.toISOString() ?? null,
          };
        }
      }

      summaries.push({
        id: conv.id,
        title: conv.title,
        messageCount: messages.length,
        lastMessage,
        createdAt: conv.created?.toISOString() ?? null,
        updatedAt: conv.updated?.toISOString() ?? null,
      });
    }

    recordMemoryToolCall("memory_history", "success");

    return {
      success: true,
      conversation: null,
      conversations: summaries,
      count: summaries.length,
      message: `Found ${summaries.length} conversations`,
    };
  },
};

export type ToolMemoryHistory = typeof toolMemoryHistory;
