import { describe, expect, it } from "bun:test";
import { eventToUiMessages, normalizeToUiMessages } from "@alfred/agent";

describe("normalizeToUiMessages (non-stream)", () => {
  it("maps text, tool-calls and tool-results", () => {
    const msgs = normalizeToUiMessages({
      text: "Hello",
      toolCalls: [{ id: "t1", toolName: "grep", args: { q: "foo" } }],
      toolResults: [{ id: "t1", toolName: "grep", result: { ok: true } }],
    });
    expect(msgs).toHaveLength(1);
    const m = msgs[0];
    if (!m) {
      throw new Error("m is null");
    }
    expect(m.role).toBe("assistant");
    expect(
      m.parts.some((p: any) => p.type === "text" && p.text === "Hello")
    ).toBe(true);
    expect(
      m.parts.some((p: any) => p.type === "tool-call" && p.toolName === "grep")
    ).toBe(true);
    expect(
      m.parts.some(
        (p: any) => p.type === "tool-result" && p.toolName === "grep"
      )
    ).toBe(true);
  });
});

describe("eventToUiMessages (stream)", () => {
  it("passthroughs ui-message events", () => {
    const msgs = eventToUiMessages({
      _: "ui-message",
      messages: [{ id: "1", role: "assistant", parts: [] }],
    } as any);
    expect(msgs).not.toBeNull();
    expect(msgs?.length).toBe(1);
    expect(msgs?.[0]?.role).toBe("assistant");
  });

  it("maps assistant with text/parts/toolCalls/toolResults", () => {
    const msgs = eventToUiMessages({
      _: "assistant",
      text: "Hello",
      toolCalls: [{ id: "x", toolName: "cat", args: { path: "README.md" } }],
      toolResults: [{ id: "x", toolName: "cat", result: "contents" }],
    } as any);
    if (!msgs) {
      throw new Error("msgs is null");
    }
    const m = msgs[0];
    if (!m) {
      throw new Error("m is null");
    }
    expect(
      m.parts.some((p: any) => p.type === "text" && p.text === "Hello")
    ).toBe(true);
    expect(
      m.parts.some((p: any) => p.type === "tool-call" && p.toolName === "cat")
    ).toBe(true);
    expect(
      m.parts.some((p: any) => p.type === "tool-result" && p.toolName === "cat")
    ).toBe(true);
  });

  it("maps reasoning to reasoning part", () => {
    const msgs = eventToUiMessages({
      _: "assistant",
      reasoning: "why",
    } as any);
    if (!msgs) {
      throw new Error("msgs is null");
    }
    expect(
      msgs[0]?.parts.some(
        (p: any) => p.type === "reasoning" && p.text === "why"
      )
    ).toBe(true);
  });

  it("maps data-status to data-status part", () => {
    const msgs = eventToUiMessages({
      _: "data-status",
      data: { ok: true },
      transient: true,
    } as any);
    if (!msgs) {
      throw new Error("msgs is null");
    }
    expect(
      msgs[0]?.parts.some(
        (p: any) => p.type === "data-status" && (p as any).data?.ok === true
      )
    ).toBe(true);
  });

  it("maps data-cache-handoff to data-cache part", () => {
    const now = new Date().toISOString();
    const msgs = eventToUiMessages({
      _: "data-cache-handoff",
      receipts: { created: now, summary: "cache handoff", code: [] },
    } as any);
    expect(msgs).toBeTruthy();
    const parts = msgs?.[0]?.parts ?? [];
    expect(parts.some((p: any) => p.type === "data-cache")).toBe(true);
  });

  it("maps file events to file parts", () => {
    const msgs = eventToUiMessages({
      _: "file",
      mediaType: "text/plain",
      url: "https://example",
    } as any);
    if (!msgs) {
      throw new Error("msgs is null");
    }
    expect(
      msgs[0]?.parts.some(
        (p: any) =>
          p.type === "file" &&
          p.mediaType === "text/plain" &&
          p.url === "https://example"
      )
    ).toBe(true);
  });
});
