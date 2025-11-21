import { Buffer } from "node:buffer";
import { describe, expect, it } from "bun:test";
import {
  decodeToPCM16,
  encodeFromPCM16,
  ensureFfmpegAvailable,
  PCM_MIME_TYPE,
} from "../../src/voice/codec";

const SAMPLE_WEBM_BASE64 =
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAASWEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggFATbuMU6uEHFO7a1OsggSA7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjIuMy4xMDBXQYxMYXZmNjIuMy4xMDBEiYhAcCAAAAAAABZUrmvlrgEAAAAAAABc14EBc8WIAMRVLdTyWxGcgQAitZyDdW5kiIEAhoZBX09QVVNWqoNjLqBWu4QExLQAg4EC4ZGfgQG1iEDPQAAAAAAAYmSBEGOik09wdXNIZWFkAQE4AYA+AAAAAAASVMNn/HNzn2PAgGfImUWjh0VOQ09ERVJEh4xMYXZmNjIuMy4xMDBzc9djwItjxYgAxFUt1PJbEWfIokWjh0VOQ09ERVJEh5VMYXZjNjIuMTEuMTAwIGxpYm9wdXNnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAwLjI1ODAwMDAwMAAfQ7Z1QrnngQCj5IEAAIBIgXr+vS60SHx0CsPA7KGN0YdOpZR6NxzbnN9KbFIX33qTjbWN6XOuI9T/P51WDmbQRntyXklIONlbrzHc3FqSUNXR1DGG4854KKWisWf2a2vRLkL7sQ6Ck3aMXAqoA4CjrIEAFYBImn4UDGiZ/D2DsIZnZUls1JY08IqCK/e8f1Bvx0lEbPopygKrmhbBo7KBACmASJkMXooHdzt0Qp9Ax5Dr0ytqyDeVToZEMsk5J+zqvhmo2rLx+8iCsKXmxgI9G6OqgQA9gEiZDACGpe6hhxWFcJOoKhsaJgBPmmXQBJ8uxic+1zi6C0+JC1GYo7CBAFGASJkMXooGl2OfWzL22npmDFrfOLxHUHCKyqdUpId1jZurjwidrofHCcLwNV+jqIEAZYBImQwAhqXuoYcVhYGEBOPzzV9sUu5/dbGca8XR5kEd6ylyNXOjpYEAeYBImQxek15NtbRvwDRW0IpHXJaAxr9AwBEaVZuwdP/geECjqIEAjYBImQwAhyXxBERI+YHvM4tflEc0Izj0UAdzJZSL6SIDL2WIMaKjrYEAoYBImQxeigaXY59baTFgA//T474yGfxAJxuejzi/mgf8QHTX+FlsobnbYKO3gQC1gEiZDF6JCf8LZiMZJ+bKdwaz/gS8fp/7f1xHpU/VMhsMet7WkhplAybqq2BcoaipPJ/W0KOugQDJgEiZDACGpe6hhxWFgyPwoPkPXtYUYedJhESDkjc9Jk8qPau9D0v8xfZlhqOqgQDdgEiZDF6TXk21tG+TYXVvQebptDUgkieiv5gyGOovxiSka5doY/XwoM+hx4EA8QBImWQUisPeEgn6xEEiI5nYijih19N9NCHqCu3iRr22lPFWYjuH/7E/e/f3V6iLjhInUR6y1xtU48Bbx47DEYSrRBWAdaKDNWfgHFO7a5G7j7OBALeK94EB8YIBwfCBAw==";

function generatePcmBase64(durationMs = 250, frequency = 440) {
  const sampleRate = 16000;
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  const buffer = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  return buffer.toString("base64");
}

describe("voice codec helpers", () => {
  it("detects ffmpeg availability upfront", () => {
    expect(() => ensureFfmpegAvailable()).not.toThrow();
  });

  it("decodes webm/opus input into PCM", async () => {
    const decoded = await decodeToPCM16({
      audioBase64: SAMPLE_WEBM_BASE64,
      mimeType: "audio/webm;codecs=opus",
    });
    expect(decoded.mimeType).toBe(PCM_MIME_TYPE);
    expect(decoded.audioBase64.length).toBeGreaterThan(100);
  });

  it("encodes PCM into mp3, opus, and wav", async () => {
    const pcmBase64 = generatePcmBase64();
    const mp3 = await encodeFromPCM16({ audioBase64: pcmBase64, format: "mp3" });
    const opus = await encodeFromPCM16({
      audioBase64: pcmBase64,
      format: "opus",
    });
    const wav = await encodeFromPCM16({ audioBase64: pcmBase64, format: "wav" });

    expect(mp3.mimeType).toBe("audio/mpeg");
    expect(opus.mimeType).toBe("audio/ogg;codecs=opus");
    expect(wav.mimeType).toBe("audio/wav");

    expect(mp3.audioBase64.length).toBeGreaterThan(100);
    expect(opus.audioBase64.length).toBeGreaterThan(100);
    expect(wav.audioBase64.length).toBeGreaterThan(100);
  });

  it("round-trips PCM -> mp3 -> PCM", async () => {
    const pcmBase64 = generatePcmBase64(150, 660);
    const mp3 = await encodeFromPCM16({ audioBase64: pcmBase64, format: "mp3" });
    const decoded = await decodeToPCM16({
      audioBase64: mp3.audioBase64,
      mimeType: mp3.mimeType,
    });
    expect(decoded.audioBase64.length).toBeGreaterThan(0);
  });
});
