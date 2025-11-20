import type { AssistantUIMessage } from "@alfred/agent";
import * as conversationRepo from "@alfred/db/repo/conversation";
import { auth } from "@alfred/auth";
import { preferenceHistoryPrunedTotal } from "@alfred/api/metrics";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { validateUIMessages } from "ai";
import { ChatContainer } from "@/components/chat-container";
import { RouteError } from "@/components/route-error";
import { limitUiMessages } from "@alfred/type/history";

const loadAssistantConversation = createServerFn({ method: "GET" }).handler(
  async ({ request }): Promise<{
    conversationId: string | null;
    messages: AssistantUIMessage[];
  }> => {
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user?.id) {
        return { conversationId: null, messages: [] };
      }

      const [latest] = await conversationRepo.getConversations(
        session.user.id,
        { limit: 1 }
      );

      if (!latest) {
        return { conversationId: null, messages: [] };
      }

      const history = await conversationRepo.getConversationHistory(
        latest.id,
        session.user.id
      );

      const rawMessages = Array.isArray(history?.messages)
        ? (history?.messages as AssistantUIMessage[])
        : [];

      if (rawMessages.length === 0) {
        return { conversationId: latest.id, messages: [] };
      }

      const limited = limitUiMessages(rawMessages);
      if (rawMessages.length > limited.length) {
        preferenceHistoryPrunedTotal.inc(
          { source: "assistant_loader" },
          rawMessages.length - limited.length
        );
      }
      const validated = (await validateUIMessages({
        messages: limited,
      })) as AssistantUIMessage[];

      return {
        conversationId: latest.id,
        messages: validated,
      };
    } catch (error) {
      console.warn("assistant_history_load_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { conversationId: null, messages: [] };
    }
  }
);

export const Route = createFileRoute("/_authed/ai")({
  loader: () => loadAssistantConversation(),
  component: RouteComponent,
  errorComponent: RouteError,
  ssr: false,
});

function RouteComponent() {
  const { conversationId, messages } = Route.useLoaderData();
  return (
    <ChatContainer
      agent="assistant"
      initialConversationId={conversationId}
      initialMessages={messages}
    />
  );
}
