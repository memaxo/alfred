import { afterEach, beforeAll, describe, expect, it, vi } from "bun:test";

let createContext: typeof import("@alfred/api/context").createContext;
let authModule: typeof import("@alfred/auth");

beforeAll(async () => {
  const [contextMod, authMod] = await Promise.all([
    import("@alfred/api/context"),
    import("@alfred/auth"),
  ]);
  createContext = contextMod.createContext;
  authModule = authMod;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createContext", () => {
  it("populates runtime metadata from headers", async () => {
    const getSessionMock = vi
      .spyOn(authModule.auth.api, "getSession")
      .mockResolvedValue({ user: { id: "user-1" } } as any);

    const req = new Request("https://example.com/test?foo=bar", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.5, 70.0.0.1",
        "x-request-id": "req-123",
        "user-agent": "bun-test",
        referer: "https://ref.example/page",
      },
    });

    const ctx = await createContext({ req });

    expect(ctx.runtime.requestId).toBe("req-123");
    expect(ctx.runtime.method).toBe("POST");
    expect(ctx.runtime.url).toBe("https://example.com/test?foo=bar");
    expect(ctx.runtime.ip).toBe("203.0.113.5");
    expect(ctx.runtime.forwardedFor).toEqual(["203.0.113.5", "70.0.0.1"]);
    expect(ctx.runtime.userAgent).toBe("bun-test");
    expect(ctx.runtime.referer).toBe("https://ref.example/page");
    expect(ctx.runtime.receivedAt).toBeInstanceOf(Date);
    expect(ctx.runtimeContext.get("requestId")).toBe("req-123");
    expect(ctx.runtimeContext.get("userId")).toBe("user-1");
    expect(ctx.runtimeContext.get("userAgent")).toBe("bun-test");
    expect(ctx.runtimeContext.get("forwardedFor")).toEqual(["203.0.113.5", "70.0.0.1"]);
  });

  it("falls back to generated request id and null ip when headers missing", async () => {
    vi.spyOn(authModule.auth.api, "getSession").mockResolvedValue(null as any);

    const req = new Request("https://example.com/other", {
      method: "GET",
    });

    const ctx = await createContext({ req });

    expect(typeof ctx.runtime.requestId).toBe("string");
    expect(ctx.runtime.requestId.length).toBeGreaterThan(0);
    expect(ctx.runtime.ip).toBeNull();
    expect(ctx.runtime.forwardedFor).toEqual([]);
    expect(ctx.runtime.userAgent).toBeNull();
    expect(ctx.runtime.referer).toBeNull();
    expect(ctx.runtimeContext.get("userId")).toBeUndefined();
    expect(ctx.runtimeContext.get("userAgent")).toBeUndefined();
    expect(ctx.runtimeContext.get("ip")).toBeNull();
  });
});
