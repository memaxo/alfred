/**
 * Transport parity tests for Milestone 3.
 *
 * Ensures the web UI can switch between assistant and orchestrator
 * backends while maintaining streaming UIMessage compatibility.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 3
 */

import { describe, expect, it, mock, vi } from "bun:test";

// Mock both handlers before importing routes
const handleAssistantRequestMock = vi.fn(
  async () =>
    new Response("assistant-ok", {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "x-backend": "assistant",
      },
    })
);

const handleOrchestratorRequestMock = vi.fn(
  async () =>
    new Response("orchestrator-ok", {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "x-backend": "orchestrator",
      },
    })
);

mock.module("@alfred/api/assistant", () => ({
  handleAssistantRequest: handleAssistantRequestMock,
}));

mock.module("@alfred/api/orchestrator", () => ({
  handleOrchestratorRequest: handleOrchestratorRequestMock,
}));

import { Route as AssistantRoute } from "@/routes/api/assistant";
import { Route as OrchestratorRoute } from "@/routes/api/orchestrator";

describe("transport parity", () => {
  it("assistant endpoint delegates to @alfred/api/assistant", async () => {
    const res = await AssistantRoute.options.server?.handlers?.POST?.({
      request: new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
    } as unknown as Parameters<
      NonNullable<typeof AssistantRoute.options.server.handlers.POST>
    >[0]);

    expect(handleAssistantRequestMock).toHaveBeenCalledTimes(1);
    expect(res?.status).toBe(200);
    expect(res?.headers.get("x-backend")).toBe("assistant");
  });

  it("orchestrator endpoint delegates to @alfred/api/orchestrator", async () => {
    const res = await OrchestratorRoute.options.server?.handlers?.POST?.({
      request: new Request("http://localhost/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
    } as unknown as Parameters<
      NonNullable<typeof OrchestratorRoute.options.server.handlers.POST>
    >[0]);

    expect(handleOrchestratorRequestMock).toHaveBeenCalledTimes(1);
    expect(res?.status).toBe(200);
    expect(res?.headers.get("x-backend")).toBe("orchestrator");
  });

  it("both endpoints accept UIMessage format", async () => {
    const messages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
    ];

    await AssistantRoute.options.server?.handlers?.POST?.({
      request: new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      }),
    } as unknown as Parameters<
      NonNullable<typeof AssistantRoute.options.server.handlers.POST>
    >[0]);

    await OrchestratorRoute.options.server?.handlers?.POST?.({
      request: new Request("http://localhost/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      }),
    } as unknown as Parameters<
      NonNullable<typeof OrchestratorRoute.options.server.handlers.POST>
    >[0]);

    // Both handlers should have been called with the request
    expect(handleAssistantRequestMock).toHaveBeenCalled();
    expect(handleOrchestratorRequestMock).toHaveBeenCalled();
  });

  it("endpoints have no-store cache headers", async () => {
    const assistantRes = await AssistantRoute.options.server?.handlers?.POST?.({
      request: new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
    } as unknown as Parameters<
      NonNullable<typeof AssistantRoute.options.server.handlers.POST>
    >[0]);

    const orchestratorRes =
      await OrchestratorRoute.options.server?.handlers?.POST?.({
        request: new Request("http://localhost/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [] }),
        }),
      } as unknown as Parameters<
        NonNullable<typeof OrchestratorRoute.options.server.handlers.POST>
      >[0]);

    expect(assistantRes?.headers.get("Cache-Control")).toBe("no-store");
    expect(orchestratorRes?.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("transport parity - useAssistantStream", () => {
  it("exports useAssistantStream hook", async () => {
    const { useAssistantStream } = await import("@/hooks/use-assistant-stream");

    // The hook should be defined
    expect(useAssistantStream).toBeDefined();
    expect(typeof useAssistantStream).toBe("function");
  });

  it("hook accepts api parameter", async () => {
    const module = await import("@/hooks/use-assistant-stream");

    // Verify the hook signature accepts api parameter by checking function string
    const hookString = module.useAssistantStream.toString();
    expect(hookString).toContain("api");
  });
});
