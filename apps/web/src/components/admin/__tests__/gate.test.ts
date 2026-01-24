import { describe, expect, it } from "bun:test";

import { isBiometricError } from "../gate";

describe("isBiometricError", () => {
  it("should return true for FORBIDDEN code", () => {
    expect(isBiometricError({ data: { code: "FORBIDDEN" } })).toBe(true);
    expect(isBiometricError({ code: "FORBIDDEN" })).toBe(true);
  });

  it("should return true for UNAUTHORIZED code", () => {
    expect(isBiometricError({ data: { code: "UNAUTHORIZED" } })).toBe(true);
    expect(isBiometricError({ code: "UNAUTHORIZED" })).toBe(true);
  });

  it("should return true if message contains biometric", () => {
    expect(isBiometricError({ message: "biometric required" })).toBe(true);
    expect(
      isBiometricError({ message: "recent biometric verification needed" })
    ).toBe(true);
  });

  it("should return false for other errors", () => {
    expect(isBiometricError({ data: { code: "NOT_FOUND" } })).toBe(false);
    expect(isBiometricError({ message: "something went wrong" })).toBe(false);
    expect(isBiometricError(null)).toBe(false);
    expect(isBiometricError(undefined)).toBe(false);
  });
});
