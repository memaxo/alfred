import { describe, expect, it } from "bun:test";

import { getVoiceStreamUrl } from "./voice-stream";

describe("getVoiceStreamUrl", () => {
  it("returns null when no origin and no directUrl", () => {
    const g = globalThis as unknown as { window?: unknown };
    const prev = g.window;
    try {
      g.window = undefined;
      expect(getVoiceStreamUrl()).toBeNull();
    } finally {
      g.window = prev;
    }
  });

  it("uses directUrl when provided", () => {
    const url = getVoiceStreamUrl({
      directUrl: "wss://example.com",
      origin: "https://ignored.test",
    });
    expect(url).toBe("wss://example.com/voice/stream");
  });

  it("defaults to same-origin (no explicit port) when port not provided", () => {
    const url = getVoiceStreamUrl({ origin: "https://alfred.app" });
    expect(url).toBe("wss://alfred.app/voice/stream");
  });

  it("uses ws for http origins", () => {
    const url = getVoiceStreamUrl({ origin: "http://localhost:3000" });
    expect(url).toBe("ws://localhost:3000/voice/stream");
  });

  it("uses provided port when set", () => {
    const url = getVoiceStreamUrl({
      origin: "https://alfred.app",
      port: "8788",
    });
    expect(url).toBe("wss://alfred.app:8788/voice/stream");
  });
});
