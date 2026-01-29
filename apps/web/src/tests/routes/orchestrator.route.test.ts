import { describe, expect, it, mock, vi } from "bun:test";

const handleOrchestratorRequestMock = vi.fn(
  async () =>
    new Response("ok", {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })
);

mock.module("@alfred/api/orchestrator", () => ({
  handleOrchestratorRequest: handleOrchestratorRequestMock,
}));

import { Route as OrchestratorRoute } from "@/routes/api/orchestrator";
import { Route as OrchestratorDollarRoute } from "@/routes/api/orchestrator/$";

describe("/api/orchestrator routes", () => {
  it("is present in routeTree.gen.ts", async () => {
    const text = await Bun.file(
      new URL("../../routeTree.gen.ts", import.meta.url)
    ).text();
    expect(text.includes("'/api/orchestrator'")).toBe(true);
  });

  it("delegates POST to @alfred/api/orchestrator", async () => {
    const res = await OrchestratorRoute.options.server?.handlers?.POST?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request("http://localhost/api/orchestrator", {
          method: "POST",
        }),
      } as any
    );

    expect(handleOrchestratorRequestMock).toHaveBeenCalledTimes(1);
    expect(res?.status).toBe(200);
  });

  it("returns 204 for DefaultChatTransport /stream probe", async () => {
    const res = await OrchestratorDollarRoute.options.server?.handlers?.GET?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request("http://localhost/api/orchestrator/abc/stream"),
      } as any
    );
    expect(res?.status).toBe(204);
  });
});
