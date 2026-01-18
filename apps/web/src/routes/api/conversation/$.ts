import { createFileRoute } from "@tanstack/react-router";

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authPkg = "@alfred/auth";
  const { auth } = await import(/* @vite-ignore */ authPkg);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export const Route = createFileRoute("/api/conversation/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) {
          return new Response(JSON.stringify({ error: "session_required" }), {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const url = new URL(request.url);
        const conversationId = url.pathname.split("/").filter(Boolean).at(-1);
        if (!conversationId) {
          return new Response(JSON.stringify({ error: "invalid_request" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const conversationRepo = await import("@alfred/db/repo/conversation");
        const history = await conversationRepo.getConversationHistory(
          conversationId,
          userId
        );

        if (!history) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        return new Response(
          JSON.stringify({
            conversation: history.conversation,
            messages: history.messages,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          }
        );
      },
    },
  },
});
