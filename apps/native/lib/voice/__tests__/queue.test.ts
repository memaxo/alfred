import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearQueue, drain, enqueue, getQueueSize } from "../queue";
import type { PendingItem } from "../voice.types";

const storage = new Map<string, string>();

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

const asyncStorage = AsyncStorage as unknown as {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const STORAGE_KEY = "voice:queue:v1";

async function snapshotQueue(): Promise<PendingItem[]> {
  const raw = await asyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PendingItem[]) : [];
}

async function ageQueue(ms: number): Promise<void> {
  const snapshot = await snapshotQueue();
  if (snapshot.length === 0) return;
  const aged = snapshot.map((item) => ({
    ...item,
    ts: item.ts - ms,
  }));
  await asyncStorage.setItem(STORAGE_KEY, JSON.stringify(aged));
}

describe("voice queue", () => {
  beforeEach(async () => {
    storage.clear();
    await clearQueue();
  });

  it("processes s2s jobs and clears the queue", async () => {
    await enqueue({
      kind: "s2s",
      payload: {
        audioBase64: "AAA",
        mimeType: "audio/webm",
      },
    });

    await ageQueue(2000);
    const processor = vi.fn(async () => {});
    await drain(async (item) => {
      await processor(item);
    });

    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor.mock.calls[0]?.[0]).toMatchObject({ kind: "s2s" });
    expect(await getQueueSize()).toBe(0);
  });

  it("retries failed jobs with backoff", async () => {
    await enqueue({
      kind: "s2s",
      payload: {
        audioBase64: "BBB",
        mimeType: "audio/webm",
      },
    });

    await ageQueue(2000);
    const processor = vi.fn(async () => {
      throw new Error("network_fail");
    });

    await drain(processor);

    expect(processor).toHaveBeenCalledTimes(1);
    const persisted = await snapshotQueue();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      retryCount: 1,
      lastError: "network_fail",
    });
  });
});
