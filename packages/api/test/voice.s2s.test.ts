import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { Buffer } from "node:buffer";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();
mock.module("node-pty", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    write: vi.fn(),
  })),
}));

process.env.OPENAI_API_KEY = "test-key";
process.env.VOICE_PROVIDER = "openai";

const generateTextMock = vi.fn();
const persistResultMock = vi.fn();
const prepareMessagesMock = vi.fn();
const originalFetch = global.fetch;

mock.module("../src/ai/messages", () => ({
  prepareModelMessagesForGenerate: prepareMessagesMock.mockImplementation(
    ({ rawMessages }: { rawMessages: unknown }) => rawMessages
  ),
}));

mock.module("../src/ai/generate", () => ({
  generateText: generateTextMock,
  persistResult: persistResultMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let restoreAssistantDefaults: (() => void) | null = null;
let restoreOrchestratorDefaults: (() => void) | null = null;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["voice.stt", "voice.tts"],
  });
  const agentModule = await import("@alfred/agent");
  const assistantSpy = vi
    .spyOn(agentModule, "getAssistantAgentDefaults")
    .mockReturnValue({
      tools: [],
      model: {
        id: "gpt-4o-mini",
        provider: "openai",
        modelId: "gpt-4o-mini",
      } as any,
      stopWhen: undefined,
    });
  const orchestratorSpy = vi
    .spyOn(agentModule, "getOrchestratorAgentDefaults")
    .mockReturnValue({
      tools: [],
      model: {
        id: "gpt-4o-mini",
        provider: "openai",
        modelId: "gpt-4o-mini",
      } as any,
      stopWhen: undefined,
    });
  restoreAssistantDefaults = () => assistantSpy.mockRestore();
  restoreOrchestratorDefaults = () => orchestratorSpy.mockRestore();
});

afterEach(() => {
  resetAllMocks();
  generateTextMock.mockReset();
  persistResultMock.mockReset();
  prepareMessagesMock.mockClear();
  global.fetch = originalFetch;
});

afterAll(() => {
  restoreAssistantDefaults?.();
  restoreOrchestratorDefaults?.();
});

describe("voice.speechToSpeech", () => {
  it("runs STT → assistant → TTS using OpenAI provider", async () => {
    const sttResponse = { text: "hello alfred", language: "en" };
    const ttsAudio = Buffer.from("tts audio");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sttResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => ttsAudio.buffer,
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    generateTextMock.mockResolvedValue({
      text: "hi there",
      toolCalls: [],
      toolResults: [],
      usage: null,
      object: null,
      steps: [],
      warnings: [],
      reasoning: null,
      finishReason: "stop",
    });
    persistResultMock.mockResolvedValue("replay-voice");

    const result = await caller.voice.speechToSpeech({
      audioBase64: Buffer.from("sample").toString("base64"),
      mimeType: "audio/webm",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(persistResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "assistant",
        result: expect.objectContaining({ text: "hi there" }),
      })
    );
    expect(result.transcript.text).toBe("hello alfred");
    expect(result.assistant.text).toBe("hi there");
    expect(result.audio.audioBase64.length).toBeGreaterThan(0);
    expect(result.durations.totalSeconds).toBeGreaterThan(0);
    expect(result.session?.id).toEqual(expect.any(String));
    expect(result.session?.status).toBe("idle");
  });

  it("returns session snapshots via voice.sessions", async () => {
    const sttResponse = { text: "hello again", language: "en" };
    const ttsAudio = Buffer.from("tts audio again");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sttResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => ttsAudio.buffer,
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    generateTextMock.mockResolvedValue({
      text: "response text",
      toolCalls: [],
      toolResults: [],
      usage: null,
      object: null,
      steps: [],
      warnings: [],
      reasoning: null,
      finishReason: "stop",
    });
    persistResultMock.mockResolvedValue("replay-voice-2");

    await caller.voice.speechToSpeech({
      audioBase64: Buffer.from("another sample").toString("base64"),
      mimeType: "audio/webm",
    });
    const sessions = await caller.voice.sessions();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]?.userId).toBe("test-user");
  });
});
