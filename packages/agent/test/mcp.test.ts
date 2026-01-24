import { tool } from "ai";
import { describe, expect, it, mock, vi } from "bun:test";
import { z } from "zod";

const listEnabledMcpServersMock = vi.fn();
mock.module("@alfred/db/repo/mcp", () => ({
  listEnabledMcpServers: listEnabledMcpServersMock,
}));

const createMcpClientMock = vi.fn();
mock.module("@ai-sdk/mcp", () => ({
  experimental_createMCPClient: createMcpClientMock,
}));

describe("loadMcpTools", () => {
  it("namespaces tools and defaults MCP tools to needsApproval", async () => {
    const closeSpy = vi.fn(async () => {});
    const execSpy = vi.fn(async () => ({ ok: true }));

    listEnabledMcpServersMock.mockResolvedValue([
      {
        id: "srv-1",
        userId: "user-1",
        label: "ext",
        transport: "http",
        url: "https://example.com/mcp",
        authType: "none",
        auth: null,
        enabled: true,
      },
    ]);

    createMcpClientMock.mockResolvedValue({
      tools: async () => ({
        ping: tool({
          description: "ping tool",
          inputSchema: z.object({}),
          execute: execSpy,
        }),
      }),
      close: closeSpy,
    });

    const { loadMcpTools } = await import("../src/mcp");
    const res = await loadMcpTools("user-1");

    expect(Object.keys(res.tools)).toEqual(["ext__ping"]);
    expect((res.tools.ext__ping as any).needsApproval).toBe(true);
    expect((res.tools.ext__ping as any).description).toContain("[mcp:ext]");

    await res.close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("closes clients on abort signal", async () => {
    const closeSpy = vi.fn(async () => {});

    listEnabledMcpServersMock.mockResolvedValue([
      {
        id: "srv-1",
        userId: "user-1",
        label: "ext",
        transport: "http",
        url: "https://example.com/mcp",
        authType: "none",
        auth: null,
        enabled: true,
      },
    ]);

    createMcpClientMock.mockResolvedValue({
      tools: async () => ({}),
      close: closeSpy,
    });

    const { loadMcpTools } = await import("../src/mcp");
    const controller = new AbortController();
    const res = await loadMcpTools("user-1", controller.signal);

    controller.abort();
    await new Promise((r) => setTimeout(r, 0));

    expect(closeSpy).toHaveBeenCalledTimes(1);
    await res.close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
