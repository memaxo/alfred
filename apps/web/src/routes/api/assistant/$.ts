import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assistant/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        // AI SDK v6 DefaultChatTransport may attempt to reconnect using:
        // GET `${api}/${chatId}/stream`. We don't currently support resuming
        // partial streams in dev, but we must avoid returning the HTML app shell.
        const url = new URL(request.url);
        if (url.pathname.endsWith("/stream")) {
          return new Response(null, {
            status: 204,
            headers: { "Cache-Control": "no-store" },
          });
        }
        return new Response("Not found", { status: 404 });
      },
      POST: async ({ request }: { request: Request }) => {
        const apiPkg = "@alfred/api/assistant";
        const { handleAssistantRequest } = await import(
          /* @vite-ignore */ apiPkg
        );
        return handleAssistantRequest(request);
      },
    },
  },
});
