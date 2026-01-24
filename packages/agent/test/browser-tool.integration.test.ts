import { installAuthTokenMock } from "@alfred/test-kit/auth/token";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { accessSync, constants as fsConstants } from "node:fs";
import path from "node:path";

installAuthTokenMock();

const tool = await import("../src/orchestrator/tool/browser");

function hasAgentBrowser(): boolean {
  if (process.env.ALFRED_TEST_AGENT_BROWSER !== "1") {
    return false;
  }
  try {
    const override = process.env.AGENT_BROWSER_BIN?.trim();
    if (override) {
      const absolute = path.isAbsolute(override)
        ? override
        : path.resolve(process.cwd(), override);
      accessSync(absolute, fsConstants.X_OK);
      return true;
    }

    const local = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      "agent-browser"
    );
    try {
      accessSync(local, fsConstants.X_OK);
      return true;
    } catch {
      // ignore
    }

    return typeof Bun.which("agent-browser") === "string";
  } catch {
    return false;
  }
}

function _resolveAgentBrowserBin(): string {
  const override = process.env.AGENT_BROWSER_BIN?.trim();
  if (override) {
    return path.isAbsolute(override)
      ? override
      : path.resolve(process.cwd(), override);
  }
  return (
    Bun.which("agent-browser") ??
    path.join(process.cwd(), "node_modules", ".bin", "agent-browser")
  );
}

describe("browser tool integration (agent-browser)", () => {
  const agentBrowserOk = hasAgentBrowser();
  let server: ReturnType<typeof Bun.serve> | null = null;
  let url = "";

  beforeAll(() => {
    if (!agentBrowserOk) {
      return;
    }
    server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/") {
          return new Response(
            `<!doctype html>
            <html lang="en">
              <head><meta charset="utf-8"><title>Agent Browser Fixture</title></head>
              <body>
                <h1 id="title">Hello</h1>
                <label for="email">Email</label>
                <input id="email" aria-label="Email" />
                <button id="submit" type="button">Submit</button>
              </body>
            </html>`,
            { headers: { "content-type": "text/html; charset=utf-8" } }
          );
        }
        return new Response("not found", { status: 404 });
      },
    });
    url = `http://127.0.0.1:${server.port}/`;
  });

  afterAll(() => {
    server?.stop(true);
    server = null;
  });

  it.skipIf(!agentBrowserOk)(
    "opens fixture + snapshots interactive refs",
    async () => {
      const runId = `test-${Date.now()}`;
      try {
        const open = await tool.toolBrowser.execute({
          input: { action: "open", url, runId, timeoutSec: 60 },
        });
        expect(open.ok).toBe(true);

        const snap = await tool.toolBrowser.execute({
          input: {
            action: "snapshot",
            runId,
            timeoutSec: 60,
            snapshot: {
              interactive: true,
              compact: true,
              depth: 6,
              scope: "body",
            },
          },
        });
        expect(snap.ok).toBe(true);

        const data = snap.details?.data as
          | { refs?: Record<string, { role?: string; name?: string }> }
          | undefined;
        if (data?.refs && typeof data.refs === "object") {
          const refs = Object.values(data.refs);
          const hasSubmit = refs.some(
            (v) => v?.role === "button" && v?.name === "Submit"
          );
          expect(hasSubmit).toBe(true);
        }
      } finally {
        await tool.toolBrowser.execute({ input: { action: "close", runId } });
      }
    },
    30_000
  );
});
