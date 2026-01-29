import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/orchestrator")({
  server: {
    handlers: {
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
