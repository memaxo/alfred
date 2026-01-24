import { describe, expect, it } from "bun:test";

import { HardwareProbe } from "../../src/physical/probe";
import { SyntheticSignal } from "../../src/physical/signal";

describe("Physical Layer (Hardware & Signal)", () => {
  it("probes hardware capabilities", async () => {
    const caps = await HardwareProbe.check();
    expect(caps).toBeDefined();
    // On this mac environment (assuming M1/M2/M3), GPU should be likely true, but let's just check types
    expect(typeof caps.gpu).toBe("boolean");
  });

  it("generates synthetic sine wave", () => {
    const duration = 100; // 100ms
    const rate = 16_000;
    const buffer = SyntheticSignal.sine(440, duration, rate);

    // 16000 samples/sec * 0.1 sec * 2 bytes/sample = 3200 bytes
    expect(buffer.byteLength).toBe(3200);

    // First sample (t=0) should be 0
    expect(buffer.readInt16LE(0)).toBe(0);
  });

  it("generates silence", () => {
    const buffer = SyntheticSignal.silence(100);
    expect(buffer.byteLength).toBe(3200);
    // Check middle sample is 0
    expect(buffer.readInt16LE(100)).toBe(0);
  });
});
