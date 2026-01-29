import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
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
