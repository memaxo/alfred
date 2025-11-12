import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingSttItem {
  ts: number;
  kind: "stt";
  payload: {
    audioBase64: string;
    mimeType: string;
    language?: string;
    prompt?: string;
  };
  retryCount: number;
  lastError?: string;
}

export interface PendingTtsItem {
  ts: number;
  kind: "tts";
  payload: {
    text: string;
    voice?: string;
  };
  retryCount: number;
  lastError?: string;
}

export type PendingItem = PendingSttItem | PendingTtsItem;

const KEY = "voice:queue:v1";
const LIMIT = 50;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

function calculateBackoff(retryCount: number): number {
  const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

async function readQueue(): Promise<PendingItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) {
      return value as PendingItem[];
    }
    return [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(item: Omit<PendingItem, "ts" | "retryCount">): Promise<void> {
  const items = await readQueue();
  const newItem: PendingItem = {
    ...item,
    ts: Date.now(),
    retryCount: 0,
  };
  items.push(newItem);
  while (items.length > LIMIT) {
    items.shift();
  }
  await writeQueue(items);
}

export async function drain(
  processor: (item: PendingItem) => Promise<void>
): Promise<void> {
  const items = await readQueue();
  if (items.length === 0) return;
  
  const now = Date.now();
  const processed: PendingItem[] = [];
  const failed: PendingItem[] = [];

  for (const item of items) {
    // Check if item should be retried based on backoff
    const backoff = calculateBackoff(item.retryCount);
    const nextRetryTime = item.ts + backoff;
    
    if (now < nextRetryTime) {
      // Not ready for retry yet
      failed.push(item);
      continue;
    }

    if (item.retryCount >= MAX_RETRIES) {
      // Max retries exceeded, skip
      continue;
    }

    try {
      await processor(item);
      processed.push(item);
    } catch (error) {
      const updatedItem: PendingItem = {
        ...item,
        retryCount: item.retryCount + 1,
        lastError: error instanceof Error ? error.message : String(error),
        ts: Date.now(), // Update timestamp for backoff calculation
      };
      failed.push(updatedItem);
    }
  }

  // Write back failed items (for retry) and remove processed ones
  await writeQueue(failed);
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getQueueSize(): Promise<number> {
  const items = await readQueue();
  return items.length;
}
