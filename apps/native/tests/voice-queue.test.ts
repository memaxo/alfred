import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { setTimeout as wait } from "node:timers/promises";

const mockStorage = new Map<string, string>();
const playbackLog: string[] = [];
const writtenFiles: string[] = [];
const savedFiles = new Map<string, string>();

const mockAsyncStorage = {
  getItem: vi.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: vi.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
};

mock.module("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: mockAsyncStorage,
  AsyncStorage: mockAsyncStorage,
  useAsyncStorage: () => mockAsyncStorage,
  ...mockAsyncStorage,
}));

mock.module("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {},
  TurboModuleRegistry: { get: vi.fn() },
}));

class MockSound {
  private onUpdate:
    | ((status: { isLoaded: boolean; didJustFinish: boolean }) => void)
    | null = null;
  private finished = false;
  constructor(private readonly uri: string) {}

  setOnPlaybackStatusUpdate(
    cb: (status: { isLoaded: boolean; didJustFinish: boolean }) => void
  ) {
    this.onUpdate = cb;
    if (this.finished) {
      cb({ isLoaded: true, didJustFinish: true });
    }
  }

  async playAsync() {
    playbackLog.push(`play:${this.uri}`);
    await wait(1);
    this.finished = true;
    this.onUpdate?.({ isLoaded: true, didJustFinish: true });
  }

  unloadAsync() {
    playbackLog.push(`unload:${this.uri}`);
  }
}

const mockCreateAsync = vi.fn(({ uri }: { uri: string }) => {
  playbackLog.push(`create:${uri}`);
  return Promise.resolve({ sound: new MockSound(uri) });
});

mock.module("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: vi.fn((...args: unknown[]) =>
        mockCreateAsync(args[0] as { uri: string })
      ),
    },
  },
}));

const mockWriteAsStringAsync = vi.fn(
  (uri: string, data: string, _options?: unknown) => {
    writtenFiles.push(uri);
    savedFiles.set(uri, data);
    return Promise.resolve();
  }
);
const mockDeleteAsync = vi.fn((uri: string) => {
  savedFiles.delete(uri);
  return Promise.resolve();
});

mock.module("expo-file-system", () => ({
  cacheDirectory: "/tmp/",
  documentDirectory: "/tmp/doc/",
  EncodingType: { Base64: "base64" },
  writeAsStringAsync: vi.fn((...args: unknown[]) =>
    mockWriteAsStringAsync(
      args[0] as string,
      args[1] as string,
      args[2] as unknown
    )
  ),
  deleteAsync: vi.fn((...args: unknown[]) =>
    mockDeleteAsync(args[0] as string)
  ),
}));

const mockConfigureAudioSession = vi.fn(async () => {});

mock.module("../lib/voice/config", () => ({
  configureAudioSession: vi.fn((..._args: unknown[]) =>
    mockConfigureAudioSession()
  ),
  resetAudioSession: vi.fn(),
  supportsBackgroundAudio: vi.fn(() => false),
  getAudioConfigHints: vi.fn(() => ({
    allowBluetooth: true,
    allowAirPlay: true,
    allowRecording: true,
  })),
}));

import type { PendingItem } from "../lib/voice/voice.types";

const STORAGE_KEY = "voice:queue:v1";
let asyncStorage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
let queueModule: typeof import("../lib/voice/queue");
let playModule: typeof import("../lib/voice/play");

async function snapshotQueue(): Promise<PendingItem[]> {
  const raw = await asyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PendingItem[]) : [];
}

async function ageQueue(ms: number): Promise<void> {
  const snapshot = await snapshotQueue();
  if (snapshot.length === 0) {
    return;
  }
  const aged = snapshot.map((item) => ({
    ...item,
    ts: item.ts - ms,
  }));
  await asyncStorage.setItem(STORAGE_KEY, JSON.stringify(aged));
}

describe("native voice queue + playback", () => {
  beforeEach(async () => {
    const asyncStorageModule =
      await import("@react-native-async-storage/async-storage");
    asyncStorage = asyncStorageModule.default as typeof asyncStorage;
    queueModule = await import("../lib/voice/queue");
    playModule = await import("../lib/voice/play");
  });

  beforeEach(async () => {
    mockStorage.clear();
    playbackLog.length = 0;
    writtenFiles.length = 0;
    savedFiles.clear();
    vi.clearAllMocks();
    await queueModule.clearQueue();
  });

  it("drains mixed audio jobs in FIFO order", async () => {
    const order: PendingItem["kind"][] = [];
    await queueModule.enqueue({
      kind: "stt",
      payload: { audioBase64: "AAA", mimeType: "audio/webm" },
    });
    await queueModule.enqueue({
      kind: "tts",
      payload: { text: "hello" },
    });
    await queueModule.enqueue({
      kind: "s2s",
      payload: { audioBase64: "BBB", mimeType: "audio/webm" },
    });

    await ageQueue(2000);

    await queueModule.drain((item) => {
      order.push(item.kind);
      return Promise.resolve();
    });

    expect(order).toStrictEqual(["stt", "tts", "s2s"]);
    await expect(queueModule.getQueueSize()).resolves.toBe(0);
  });

  it("preserves audio payloads when retries are scheduled", async () => {
    await queueModule.enqueue({
      kind: "s2s",
      payload: {
        audioBase64: "CDE",
        mimeType: "audio/webm",
      },
    });

    const processor = vi.fn(() => {
      throw new Error("transient");
    });
    await ageQueue(2000);
    await queueModule.drain(processor);

    const persisted = await snapshotQueue();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.payload).toMatchObject({
      audioBase64: "CDE",
      mimeType: "audio/webm",
    });
    expect(persisted[0]?.retryCount).toBe(1);
  });

  it("drops oldest entries when queue exceeds the limit", async () => {
    for (let i = 0; i < 55; i += 1) {
      await queueModule.enqueue({
        kind: "stt",
        payload: {
          audioBase64: `chunk-${i}`,
          mimeType: "audio/webm",
        },
      });
    }
    const snapshot = await snapshotQueue();
    expect(snapshot).toHaveLength(50);
    const firstItem = snapshot[0];
    if (firstItem && "audioBase64" in firstItem.payload) {
      expect(firstItem.payload.audioBase64).toBe("chunk-5");
    }
  });

  it("serializes playback using expo-av mocks", async () => {
    await playModule.playBase64(
      Buffer.from("clip-one").toString("base64"),
      "audio/mpeg"
    );
    await playModule.playBase64(
      Buffer.from("clip-two").toString("base64"),
      "audio/mpeg"
    );

    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(2);
    expect(mockDeleteAsync).toHaveBeenCalledTimes(2);
    expect(mockCreateAsync).toHaveBeenCalledTimes(2);
    expect(playbackLog).toContainEqual(expect.stringContaining("play:"));
    expect(
      playbackLog.filter((event) => event.startsWith("play:"))
    ).toHaveLength(2);
  });

  it("configures native audio session before playback starts", async () => {
    await playModule.playBase64(
      Buffer.from("clip-three").toString("base64"),
      "audio/mpeg"
    );
    expect(mockConfigureAudioSession).toHaveBeenCalledWith(expect.any(Object), {
      background: true,
    });
  });
});
