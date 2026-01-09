import type { UIMessage } from "@alfred/type/stream";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db, dbDriver } from "../client.js";
import { conversations, messages } from "../schema/conversation.js";

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

const DEFAULT_LIMIT = 100;
const MAX_PREPARED_LIMIT = 200;
const usePreparedStatements = dbDriver === "postgres";

type PreparedQuery<TParams, TResult> = {
  execute(params: TParams): Promise<TResult>;
};

const conversationSelection = {
  id: conversations.id,
  userId: conversations.userId,
  projectId: conversations.projectId,
  title: conversations.title,
  workflowId: conversations.workflowId,
  created: conversations.created,
  updated: conversations.updated,
};

const messageSelection = {
  id: messages.id,
  conversationId: messages.conversationId,
  userId: messages.userId,
  role: messages.role,
  parts: messages.parts,
  metadata: messages.metadata,
  created: messages.created,
};

const getConversationsStmt: PreparedQuery<
  { userId: string },
  ConversationRow[]
> = usePreparedStatements
  ? (db
      .select(conversationSelection)
      .from(conversations)
      .where(eq(conversations.userId, sql.placeholder("userId")))
      .orderBy(desc(conversations.updated))
      .limit(MAX_PREPARED_LIMIT)
      .prepare("get_user_conversations") as PreparedQuery<
      { userId: string },
      ConversationRow[]
    >)
  : {
      execute: async ({ userId }) =>
        db
          .select(conversationSelection)
          .from(conversations)
          .where(eq(conversations.userId, userId))
          .orderBy(desc(conversations.updated))
          .limit(MAX_PREPARED_LIMIT),
    };

const getMessagesStmt: PreparedQuery<{ conversationId: string }, MessageRow[]> =
  usePreparedStatements
    ? (db
        .select(messageSelection)
        .from(messages)
        .where(eq(messages.conversationId, sql.placeholder("conversationId")))
        .orderBy(messages.created)
        .prepare("get_conversation_messages") as PreparedQuery<
        { conversationId: string },
        MessageRow[]
      >)
    : {
        execute: async ({ conversationId }) =>
          db
            .select(messageSelection)
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(messages.created),
      };

const getMessageStmt: PreparedQuery<
  { messageId: string; userId: string },
  MessageRow[]
> = usePreparedStatements
  ? (db
      .select(messageSelection)
      .from(messages)
      .where(
        and(
          eq(messages.id, sql.placeholder("messageId")),
          eq(messages.userId, sql.placeholder("userId"))
        )
      )
      .limit(1)
      .prepare("get_message_with_ownership") as PreparedQuery<
      { messageId: string; userId: string },
      MessageRow[]
    >)
  : {
      execute: async ({ messageId, userId }) =>
        db
          .select(messageSelection)
          .from(messages)
          .where(and(eq(messages.id, messageId), eq(messages.userId, userId)))
          .limit(1),
    };

export async function createConversation(
  userId: string,
  title?: string,
  workflowId?: string,
  projectId?: string
): Promise<ConversationRow> {
  const [row] = await db
    .insert(conversations)
    .values({
      userId,
      projectId: projectId ?? null,
      title: title ?? null,
      workflowId: workflowId ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("failed_to_create_conversation");
  }

  return row;
}

export async function getConversationByWorkflow(
  userId: string,
  workflowId: string
): Promise<ConversationRow | null> {
  if (!workflowId) {
    return null;
  }

  const [row] = await db
    .select(conversationSelection)
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.workflowId, workflowId)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<ConversationRow | null> {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function getConversations(
  userId: string,
  options: { days?: number; limit?: number } = {}
): Promise<ConversationRow[]> {
  const { days, limit = DEFAULT_LIMIT } = options;

  if (typeof days === "number" && Number.isFinite(days) && days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return db
      .select(conversationSelection)
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          gte(conversations.created, cutoff)
        )
      )
      .orderBy(desc(conversations.updated))
      .limit(limit);
  }

  const rows = await getConversationsStmt.execute({ userId });
  return rows.slice(0, limit);
}

export async function createMessage(
  userId: string,
  conversationId: string,
  message: UIMessage
): Promise<MessageRow | null> {
  const convo = await getConversation(conversationId, userId);
  if (!convo) {
    throw new Error("conversation_not_found");
  }

  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      userId,
      role: message.role,
      parts: (message.parts ?? []) as UIMessage["parts"],
      metadata: message.metadata ?? null,
      id: message.id,
    })
    .onConflictDoUpdate({
      target: messages.id,
      set: {
        parts: (message.parts ?? []) as UIMessage["parts"],
        metadata: message.metadata ?? null,
      },
    })
    .returning();

  return row ?? null;
}

export async function getMessage(
  messageId: string,
  userId: string
): Promise<MessageRow | null> {
  const [row] = await getMessageStmt.execute({ messageId, userId });
  return row ?? null;
}

export async function getMessages(
  conversationId: string,
  userId: string
): Promise<MessageRow[]> {
  const convo = await getConversation(conversationId, userId);
  if (!convo) {
    return [];
  }

  return getMessagesStmt.execute({ conversationId });
}

export async function deleteMessagesAfter(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const convo = await getConversation(conversationId, userId);
  if (!convo) {
    return;
  }

  const message = await getMessage(messageId, userId);
  if (!message) {
    return;
  }

  await db
    .delete(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.userId, userId),
        sql`${messages.created} > ${message.created}`
      )
    );
}

export function messageRowToUIMessage(row: MessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: (row.parts ?? []) as UIMessage["parts"],
    metadata: row.metadata ?? undefined,
  };
}

export type ConversationHistory = {
  conversation: ConversationRow;
  messages: UIMessage[];
};

export async function getConversationHistory(
  conversationId: string,
  userId: string
): Promise<ConversationHistory | null> {
  const convo = await getConversation(conversationId, userId);
  if (!convo) {
    return null;
  }

  const rows = await getMessages(conversationId, userId);
  return {
    conversation: convo,
    messages: rows.map(messageRowToUIMessage),
  };
}

export async function getActiveUserIds(
  options: { days?: number; limit?: number } = {}
): Promise<string[]> {
  const { days = 30, limit = 100 } = options;
  const cutoff =
    typeof days === "number" && Number.isFinite(days) && days > 0
      ? (() => {
          const date = new Date();
          date.setDate(date.getDate() - days);
          return date;
        })()
      : null;

  const baseQuery = db
    .selectDistinct({ userId: conversations.userId })
    .from(conversations);

  const filteredQuery = cutoff
    ? baseQuery.where(gte(conversations.updated, cutoff))
    : baseQuery;

  const rows = await filteredQuery
    .orderBy(desc(conversations.updated))
    .limit(limit);
  return rows
    .map((row) => row.userId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
