import { describe, expect, it } from "bun:test";

import { isVoiceStreamingEnabled } from "./streaming";

describe("isVoiceStreamingEnabled", () => {
  it("returns false when unset", () => {
    expect(isVoiceStreamingEnabled({})).toBe(false);
  });

  it("returns true for '1'", () => {
    expect(isVoiceStreamingEnabled({ VOICE_STREAMING_PROTO: "1" })).toBe(true);
  });

  it("returns true for 'true' (case-insensitive)", () => {
    expect(isVoiceStreamingEnabled({ VOICE_STREAMING_PROTO: "TrUe" })).toBe(
      true
    );
  });

  it("returns false for other values", () => {
    expect(isVoiceStreamingEnabled({ VOICE_STREAMING_PROTO: "ws" })).toBe(
      false
    );
    expect(isVoiceStreamingEnabled({ VOICE_STREAMING_PROTO: "0" })).toBe(false);
  });
});
