import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

async function handler({ request }: { request: Request }) {
  const contextPkg = "@alfred/api/context";
  const routersPkg = "@alfred/api/routers/index";

  const { createContext } = await import(/* @vite-ignore */ contextPkg);
  const { appRouter } = await import(/* @vite-ignore */ routersPkg);

  return fetchRequestHandler({
    req: request,
    router: appRouter,
    createContext,
    endpoint: "/api/trpc",
  });
}

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
