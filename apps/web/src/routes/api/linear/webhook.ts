import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/linear/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const api = await import("@alfred/api/linear-webhook");
        return api.handleLinearWebhook(request);
      },
    },
  },
});
