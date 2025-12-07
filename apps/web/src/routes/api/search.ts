import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

const server = createFromSource(source, {
  language: "english",
});

export const Route = createFileRoute("/api/search")({
  // @ts-expect-error - TanStack Start server handlers
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => server.GET(request),
    },
  },
});
