import { createFileRoute } from "@tanstack/react-router";

async function handler({ request }: { request: Request }) {
  const trpcFetchPkg = "@trpc/server/adapters/fetch";
  const contextPkg = "@alfred/api/context";
  const routersPkg = "@alfred/api/routers/index";

  const { fetchRequestHandler } = await import(/* @vite-ignore */ trpcFetchPkg);
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
