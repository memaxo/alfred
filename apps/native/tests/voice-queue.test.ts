import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { setTimeout as wait } from "node:timers/promises";

const storage = new Map<string, string>();
const playbackLog: string[] = [];
const writtenFiles: string[] = [];
const savedFiles = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: async (key: string) => {
      storage.delete(key);
    },
  },
}));

mock.module("react-native", () => ({}));
mock.module("react-native/index.js", () => ({}));
mock.module("react-native/index", () => ({}));

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

  async unloadAsync() {
    playbackLog.push(`unload:${this.uri}`);
  }
}

const createAsyncMock = vi
  .fn()
  .mockImplementation(async ({ uri }: { uri: string }) => {
    playbackLog.push(`create:${uri}`);
    return { sound: new MockSound(uri) };
  });

mock.module("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: createAsyncMock,
    },
  },
}));

const writeAsStringAsyncMock = vi.fn(
  async (uri: string, data: string, _options?: unknown) => {
    writtenFiles.push(uri);
    savedFiles.set(uri, data);
  }
);
const deleteAsyncMock = vi.fn(async (uri: string) => {
  savedFiles.delete(uri);
});

mock.module("expo-file-system", () => ({
  cacheDirectory: "/tmp/",
  documentDirectory: "/tmp/doc/",
  EncodingType: { Base64: "base64" },
  writeAsStringAsync: writeAsStringAsyncMock,
  deleteAsync: deleteAsyncMock,
}));

const configureAudioSessionMock = vi.fn(async () => {});

mock.module("../lib/voice/config", () => ({
  configureAudioSession: configureAudioSessionMock,
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingItem } from "../lib/voice/voice.types";

type QueueModule = typeof import("../lib/voice/queue");
type PlayModule = typeof import("../lib/voice/play");
type ConfigModule = typeof import("../lib/voice/config");

let queueModule: QueueModule;
let playModule: PlayModule;
let configModule: ConfigModule;

const STORAGE_KEY = "voice:queue:v1";

async function snapshotQueue(): Promise<PendingItem[]> {
  const raw = await (AsyncStorage as any).getItem(STORAGE_KEY);
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
  await (AsyncStorage as any).setItem(STORAGE_KEY, JSON.stringify(aged));
}

describe("native voice queue + playback", () => {
  beforeAll(async () => {
    queueModule = await import("../lib/voice/queue");
    playModule = await import("../lib/voice/play");
    configModule = await import("../lib/voice/config");
  });

  beforeEach(async () => {
    storage.clear();
    playbackLog.length = 0;
    writtenFiles.length = 0;
    savedFiles.clear();
    createAsyncMock.mockClear();
    writeAsStringAsyncMock.mockClear();
    deleteAsyncMock.mockClear();
    configureAudioSessionMock.mockClear();
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

    await queueModule.drain(async (item) => {
      order.push(item.kind);
    });

    expect(order).toEqual(["stt", "tts", "s2s"]);
    expect(await queueModule.getQueueSize()).toBe(0);
  });

  it("preserves audio payloads when retries are scheduled", async () => {
    await queueModule.enqueue({
      kind: "s2s",
      payload: {
        audioBase64: "CDE",
        mimeType: "audio/webm",
      },
    });

    const processor = vi.fn(async () => {
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
    expect(snapshot[0]?.payload.audioBase64).toBe("chunk-5");
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

    expect(writeAsStringAsyncMock).toHaveBeenCalledTimes(2);
    expect(deleteAsyncMock).toHaveBeenCalledTimes(2);
    expect(createAsyncMock).toHaveBeenCalledTimes(2);
    expect(playbackLog).toContainEqual(expect.stringContaining("play:"));
    expect(playbackLog.filter((event) => event.startsWith("play:"))).toHaveLength(
      2
    );
  });

  it("configures native audio session before playback starts", async () => {
    await playModule.playBase64(
      Buffer.from("clip-three").toString("base64"),
      "audio/mpeg"
    );
    expect(configModule.configureAudioSession).toBe(
      configureAudioSessionMock
    );
    expect(configureAudioSessionMock).toHaveBeenCalledWith(
      expect.any(Object),
      { background: true }
    );
  });
});
