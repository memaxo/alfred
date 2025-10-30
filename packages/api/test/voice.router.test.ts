import { beforeAll, beforeEach, afterEach, describe, expect, it, vi, mock } from "bun:test";
import { RuntimeContext } from "@mastra/core/runtime-context";
import "./utils/agent-mock";

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

mock.module("@alfred/policy", () => ({
  evaluate: vi.fn().mockResolvedValue({ allow: true, obligations: [] }),
  registerPolicyCacheObserver: vi.fn(),
}));

let appRouter: typeof import("@alfred/api/routers/index").appRouter;

beforeAll(async () => {
  const mod = await import("@alfred/api/routers/index");
  appRouter = mod.appRouter;
});

function createCaller() {
  const receivedAt = new Date();
  const runtime = {
    requestId: "voice-test",
    receivedAt,
    method: "POST",
    url: "http://localhost/api/trpc/voice",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: "bun-test",
    referer: null,
  };
  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
    ["userId", "user-voice"],
    ["userRoles", ["owner"]],
    ["userScopes", ["voice.use"]],
  ]);
  return appRouter.createCaller({
    session: {
      user: {
        id: "user-voice",
        roles: ["owner"],
        scopes: ["voice.use"],
      },
    },
    runtime,
    runtimeContext,
  } as any);
}

let fetchMock: ReturnType<typeof vi.fn>;
let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "https://api.openai.com";
  fetchMock = vi.fn();
  originalFetch = globalThis.fetch;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  if (originalFetch) {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    originalFetch = undefined;
  }
  vi.restoreAllMocks();
});

describe("voice router", () => {
  it("transcribes short audio clips via OpenAI", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "call Jack", language: "en" }),
    } as Response);

    const caller = createCaller();
    const result = await caller.voice.sttTranscribe({
      audioBase64: btoa("audio"),
      mimeType: "audio/webm",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("/v1/audio/transcriptions");
    expect((init as any)?.method).toBe("POST");
    const body = (init as any)?.body;
    expect(body instanceof FormData).toBe(true);
    if (body instanceof FormData) {
      const keys = Array.from(body.keys());
      expect(keys).toEqual(expect.arrayContaining(["file", "model", "response_format"]));
    }
    expect(result.text).toBe("call Jack");
    expect(result.language).toBe("en");
  });

  it("synthesizes speech responses", async () => {
    const audioBuffer = new TextEncoder().encode("audio-bytes");
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => audioBuffer,
    } as unknown as Response);

    const caller = createCaller();
    const result = await caller.voice.ttsSynthesize({
      text: "Drive safely.",
      voice: "alloy",
      format: "mp3",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("/v1/audio/speech");
    expect((init as any)?.method).toBe("POST");
    expect(result.audioBase64.length).toBeGreaterThan(0);
    expect(result.mimeType).toBe("audio/mpeg");
  });

  it("fails when OpenAI API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const caller = createCaller();
    await expect(
      caller.voice.sttTranscribe({
        audioBase64: btoa("audio"),
        mimeType: "audio/webm",
      }),
    ).rejects.toThrow("openai_api_key_missing");
  });
});
