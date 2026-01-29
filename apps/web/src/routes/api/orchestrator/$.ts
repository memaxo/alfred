import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/orchestrator/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
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
        const apiPkg = "@alfred/api/orchestrator";
        const { handleOrchestratorRequest } = await import(
          /* @vite-ignore */ apiPkg
        );
        return handleOrchestratorRequest(request);
      },
    },
  },
});
