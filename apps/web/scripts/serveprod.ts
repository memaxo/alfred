const host = process.env.MINDSCAPE_HOST ?? "127.0.0.1";
const port = Number(process.env.MINDSCAPE_PORT ?? 3100);

const rootUrl = new URL("../dist/client/", import.meta.url);
const root = rootUrl.pathname.replace(/\/$/, "");
const indexPath = `${root}/index.html`;

function resolvePath(url: URL): string | null {
  const rawPath = url.pathname;
  if (!rawPath.startsWith("/")) {
    return null;
  }

  // Prevent path traversal
  if (rawPath.includes("..")) {
    return null;
  }

  return `${root}${rawPath}`;
}

const server = Bun.serve({
  hostname: host,
  port,
  fetch: async (request) => {
    const url = new URL(request.url);
    const filePath = resolvePath(url);

    if (filePath) {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: file.type ? { "content-type": file.type } : undefined,
        });
      }
    }

    // SPA-style fallback for client routing
    const indexFile = Bun.file(indexPath);
    return new Response(indexFile, {
      headers: indexFile.type ? { "content-type": indexFile.type } : undefined,
    });
  },
});

process.stdout.write(`[serveprod] http://${host}:${server.port}\n`);
