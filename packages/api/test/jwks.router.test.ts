import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { createTestCaller } from "./utils/trpc";
import { resetAllMocks, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();

const getJWKSMock = vi.fn();

mock.module("@alfred/auth/jwks", () => ({
  getJWKS: getJWKSMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
});

describe("jwks router", () => {
  describe("get", () => {
    it("returns JWKS", async () => {
      const mockJWKS = {
        keys: [
          {
            kty: "EC",
            kid: "key-1",
            use: "sig",
          },
        ],
      };

      getJWKSMock.mockResolvedValue(mockJWKS);

      const result = await caller.jwks.get();

      expect(getJWKSMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockJWKS);
    });
  });
});

