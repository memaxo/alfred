import { createFileRoute } from "@tanstack/react-router";

type SearchServer = {
  GET: (request: Request) => Response | Promise<Response>;
};

let server: SearchServer | null = null;

async function getSearchServer(): Promise<SearchServer> {
  if (server) {
    return server;
  }

  const fumadocsPkg = "fumadocs-core/search/server";
  const sourcePkg = "@/lib/source";

  const [{ createFromSource }, { source }] = await Promise.all([
    import(fumadocsPkg),
    import(sourcePkg),
  ]);

  server = createFromSource(source, { language: "english" }) as SearchServer;
  return server;
}

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const s = await getSearchServer();
        return s.GET(request);
      },
    },
  },
});
