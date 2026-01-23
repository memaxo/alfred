import { describe, expect, it, mock, vi } from "bun:test";

const streamObjectMock = vi.fn();

mock.module("ai", () => ({
  streamObject: streamObjectMock,
}));

mock.module("@alfred/agent/selector", () => ({
  getModelForRole: vi.fn().mockResolvedValue({
    model: { id: "mock-model" },
    modelKey: "openai/gpt-4o-mini",
    capabilities: ["genui"],
  }),
  supportsGenUI: () => true,
}));

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "user-1" },
      }),
    },
  },
}));

import { Route } from "@/routes/api/genui";

describe("/api/genui route", () => {
  it("is present in routeTree.gen.ts", async () => {
    const text = await Bun.file(
      new URL("../../routeTree.gen.ts", import.meta.url)
    ).text();
    expect(text.includes("'/api/genui'")).toBe(true);
  });

  it("returns 401 when session is missing", async () => {
    // Override auth for this test only.
    const authPkg = "@alfred/auth";
    const { auth } = await import(
      /* @vite-ignore */
      authPkg
    );
    (
      auth.api.getSession as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(null);

    const res = await Route.options.server?.handlers?.POST?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request("http://localhost/api/genui", { method: "POST" }),
      } as any
    );

    expect(res?.status).toBe(401);
  });

  it("streams a text response when GenUI is supported", async () => {
    streamObjectMock.mockReturnValueOnce({
      toTextStreamResponse: (init?: ResponseInit) =>
        new Response("{}", {
          ...init,
          headers: {
            ...(init?.headers ?? {}),
            "content-type": "text/plain; charset=utf-8",
          },
        }),
    });

    const res = await Route.options.server?.handlers?.POST?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request("http://localhost/api/genui", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: "show a chart", data: [1, 2, 3] }),
        }),
      } as any
    );

    expect(res).toBeTruthy();
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
    expect(res?.headers.get("x-model")).toBe("openai/gpt-4o-mini");
  });
});
