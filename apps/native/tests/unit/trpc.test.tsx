import { describe, expect, it, mock } from "bun:test";

// Mock tRPC
mock.module("@/utils/trpc", () => ({
  trpc: {
    note: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => ({ mutate: () => {}, isPending: false }) },
    },
  },
}));

describe("tRPC hooks", () => {
  it("dummy test", () => {
    expect(true).toBe(true);
  });
});
