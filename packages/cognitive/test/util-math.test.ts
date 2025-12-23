import { describe, expect, it } from "bun:test";

import {
  autonomy,
  clamp01,
  confidence,
  CONFIDENCE_DECAY_RATE,
  MS_PER_DAY,
  timestamp,
} from "../src/util/math";

describe("clamp01", () => {
  it("returns value unchanged when within [0, 1]", () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(-0.001)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });

  it("clamps values above 1 to 1", () => {
    expect(clamp01(1.001)).toBe(1);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(100)).toBe(1);
  });

  it("handles edge cases", () => {
    expect(clamp01(Number.EPSILON)).toBeGreaterThan(0);
    expect(clamp01(1 - Number.EPSILON)).toBeLessThan(1);
  });
});

describe("confidence brand constructor", () => {
  it("accepts valid values in [0, 1]", () => {
    expect(() => confidence(0)).not.toThrow();
    expect(() => confidence(0.5)).not.toThrow();
    expect(() => confidence(1)).not.toThrow();
  });

  it("rejects values below 0", () => {
    expect(() => confidence(-0.001)).toThrow("Invalid confidence");
    expect(() => confidence(-1)).toThrow("Invalid confidence");
  });

  it("rejects values above 1", () => {
    expect(() => confidence(1.001)).toThrow("Invalid confidence");
    expect(() => confidence(2)).toThrow("Invalid confidence");
  });

  it("returns the branded number", () => {
    const c = confidence(0.7);
    expect(Number(c)).toBe(0.7);
  });
});

describe("autonomy brand constructor", () => {
  it("accepts valid values in [0, 1]", () => {
    expect(() => autonomy(0)).not.toThrow();
    expect(() => autonomy(0.5)).not.toThrow();
    expect(() => autonomy(1)).not.toThrow();
  });

  it("rejects values below 0", () => {
    expect(() => autonomy(-0.001)).toThrow("Invalid autonomy");
    expect(() => autonomy(-1)).toThrow("Invalid autonomy");
  });

  it("rejects values above 1", () => {
    expect(() => autonomy(1.001)).toThrow("Invalid autonomy");
    expect(() => autonomy(2)).toThrow("Invalid autonomy");
  });

  it("returns the branded number", () => {
    const a = autonomy(0.3);
    expect(Number(a)).toBe(0.3);
  });
});

describe("timestamp brand constructor", () => {
  it("accepts zero and positive values", () => {
    expect(() => timestamp(0)).not.toThrow();
    expect(() => timestamp(1)).not.toThrow();
    expect(() => timestamp(Date.now())).not.toThrow();
  });

  it("rejects negative values", () => {
    expect(() => timestamp(-1)).toThrow("Timestamp cannot be negative");
  });

  it("rejects NaN", () => {
    expect(() => timestamp(NaN)).toThrow("Timestamp must be a finite number");
  });

  it("rejects Infinity", () => {
    expect(() => timestamp(Infinity)).toThrow("Timestamp must be a finite number");
    expect(() => timestamp(-Infinity)).toThrow("Timestamp must be a finite number");
  });
});

describe("constants", () => {
  it("MS_PER_DAY equals 86400000", () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
  });

  it("CONFIDENCE_DECAY_RATE is 0.95", () => {
    expect(CONFIDENCE_DECAY_RATE).toBe(0.95);
  });
});
