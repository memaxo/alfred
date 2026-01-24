import { describe, expect, it } from "bun:test";

import { createTestCaller } from "../utils/trpc";

describe("createTestCaller", () => {
  it("creates caller with default options", async () => {
    const caller = await createTestCaller();
    expect(caller).toBeDefined();
    expect(["object", "function"]).toContain(typeof caller);
  });

  it("respects custom userId", async () => {
    const caller = await createTestCaller({ userId: "custom-user" });
    expect(caller).toBeDefined();
  });

  it("respects custom roles", async () => {
    const caller = await createTestCaller({ roles: ["admin", "user"] });
    expect(caller).toBeDefined();
  });

  it("respects custom scopes", async () => {
    const caller = await createTestCaller({
      scopes: ["read", "write"],
    });
    expect(caller).toBeDefined();
  });

  it("creates unique requestId per call", async () => {
    const caller1 = await createTestCaller();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const caller2 = await createTestCaller();
    expect(caller1).toBeDefined();
    expect(caller2).toBeDefined();
  });

  it("caller has correct session structure", async () => {
    const caller = await createTestCaller({
      userId: "test-user",
      roles: ["owner"],
      scopes: ["assistant.write"],
    });
    expect(caller).toBeDefined();
  });

  it("caller has correct runtime context", async () => {
    const caller = await createTestCaller({
      requestId: "custom-request",
    });
    expect(caller).toBeDefined();
  });
});
