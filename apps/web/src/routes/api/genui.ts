import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/genui")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiPkg = "@alfred/api/genui";
        const { handleGenUiRequest } = await import(/* @vite-ignore */ apiPkg);
        return handleGenUiRequest(request);
      },
    },
  },
});
