import { describe, expect, it, mock, vi } from "bun:test";

const handleAssistantRequestMock = vi.fn(
  async () =>
    new Response("ok", {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })
);

mock.module("@alfred/api/assistant", () => ({
  handleAssistantRequest: handleAssistantRequestMock,
}));

import { Route as AssistantRoute } from "@/routes/api/assistant";
import { Route as AssistantDollarRoute } from "@/routes/api/assistant/$";

describe("/api/assistant routes", () => {
  it("is present in routeTree.gen.ts", async () => {
    const text = await Bun.file(
      new URL("../../routeTree.gen.ts", import.meta.url)
    ).text();
    expect(text.includes("'/api/assistant'")).toBe(true);
  });

  it("delegates POST to @alfred/api/assistant", async () => {
    const res = await AssistantRoute.options.server?.handlers?.POST?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request("http://localhost/api/assistant", {
          method: "POST",
        }),
      } as any
    );

    expect(handleAssistantRequestMock).toHaveBeenCalledTimes(1);
    expect(res?.status).toBe(200);
  });

  it("returns 204 for DefaultChatTransport /stream probe", async () => {
    const res = await AssistantDollarRoute.options.server?.handlers?.GET?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request("http://localhost/api/assistant/abc/stream"),
      } as any
    );
    expect(res?.status).toBe(204);
  });
});
