import { describe, expect, it } from "bun:test";
import { getVoiceStreamUrlForTest } from "./env";

describe("getVoiceStreamUrlForTest", () => {
  it("returns null when no baseUrl and no directUrl", () => {
    expect(getVoiceStreamUrlForTest({})).toBeNull();
  });

  it("uses directUrl when provided", () => {
    const url = getVoiceStreamUrlForTest({
      directUrl: "wss://example.com",
      baseUrl: "https://ignored.test",
    });
    expect(url).toBe("wss://example.com/voice/stream");
  });

  it("defaults to same-origin port when port not provided", () => {
    const url = getVoiceStreamUrlForTest({
      baseUrl: "https://alfred.app",
    });
    expect(url).toBe("wss://alfred.app/voice/stream");
  });

  it("uses ws for http baseUrl", () => {
    const url = getVoiceStreamUrlForTest({
      baseUrl: "http://localhost:3000",
    });
    expect(url).toBe("ws://localhost:3000/voice/stream");
  });

  it("uses provided port when set", () => {
    const url = getVoiceStreamUrlForTest({
      baseUrl: "https://alfred.app",
      port: "8788",
    });
    expect(url).toBe("wss://alfred.app:8788/voice/stream");
  });
});
