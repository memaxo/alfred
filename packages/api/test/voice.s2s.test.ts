import { parsePersonaTelemetry } from "@alfred/persona";
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

const transcribeLocalMock = vi.fn();
const synthesizeLocalMock = vi.fn();

mock.module("@alfred/api/voice/pools", () => ({
  getVoicePools: () => ({
    sttPool: { size: 1, activeCount: 0 } as any,
    ttsPool: { size: 1, activeCount: 0 } as any,
    voiceRegistry: { createSession: vi.fn(), removeSession: vi.fn() } as any,
  }),
  initializeVoicePools: async () => {},
  shutdownVoicePools: async () => {},
}));

mock.module("@alfred/voice/services/stt", () => ({
  transcribeLocal: transcribeLocalMock,
}));

mock.module("@alfred/voice/services/tts", () => ({
  synthesizeLocal: synthesizeLocalMock,
}));

const generateTextMock = vi.fn();
const persistResultMock = vi.fn();
const prepareMessagesMock = vi.fn();

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
  transcribeLocalMock.mockReset();
  synthesizeLocalMock.mockReset();
});

afterAll(() => {
  restoreAssistantDefaults?.();
  restoreOrchestratorDefaults?.();
});

describe("voice.speechToSpeech", () => {
  it("runs STT → assistant → TTS using the Maya1 provider", async () => {
    const sttResponse = {
      text: "hello alfred",
      language: "en",
      model: "faster-whisper",
      provider: "maya1",
      durationSeconds: 0.1,
    };
    const ttsAudio = Buffer.from("tts audio");

    transcribeLocalMock.mockResolvedValue(sttResponse);
    synthesizeLocalMock.mockResolvedValue({
      audioBase64: ttsAudio.toString("base64"),
      mimeType: "audio/mpeg",
      model: "maya1",
      provider: "maya1",
      durationSeconds: 0.2,
    });
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

    expect(transcribeLocalMock).toHaveBeenCalledTimes(1);
    expect(synthesizeLocalMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(persistResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "assistant",
        result: expect.objectContaining({ text: "hi there" }),
      })
    );
    expect(result.transcript.text).toBe("hello alfred");
    expect(result.assistant?.text).toContain("hi there");
    expect(result.assistant?.text ?? "").not.toContain("personaTelemetry");
    expect(result.assistant?.text ?? "").not.toContain("speechAct");

    const raw = result.assistant?.raw as
      | { meta?: { personaTelemetry?: unknown } }
      | undefined;
    const telemetry = raw?.meta?.personaTelemetry;
    expect(telemetry).toBeDefined();
    const parsed = parsePersonaTelemetry(telemetry);
    expect(parsed.ok).toBe(true);
    expect(result.audio.audioBase64.length).toBeGreaterThan(0);
    expect(result.durations.totalSeconds).toBeGreaterThan(0);
    expect(result.session?.id).toEqual(expect.any(String));
    expect(result.session?.status).toBe("idle");
  });

  it("returns session snapshots via voice.sessions", async () => {
    const sttResponse = {
      text: "hello again",
      language: "en",
      model: "faster-whisper",
      provider: "maya1",
      durationSeconds: 0.1,
    };
    const ttsAudio = Buffer.from("tts audio again");

    transcribeLocalMock.mockResolvedValue(sttResponse);
    synthesizeLocalMock.mockResolvedValue({
      audioBase64: ttsAudio.toString("base64"),
      mimeType: "audio/mpeg",
      model: "maya1",
      provider: "maya1",
      durationSeconds: 0.2,
    });
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
