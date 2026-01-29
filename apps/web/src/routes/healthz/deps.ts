import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/healthz/deps")({
  server: {
    handlers: {
      GET: async () => {
        const healthPkg = "@alfred/api/healthz-deps";
        const { handleHealthzDeps } = await import(
          /* @vite-ignore */ healthPkg
        );
        return handleHealthzDeps();
      },
    },
  },
});
