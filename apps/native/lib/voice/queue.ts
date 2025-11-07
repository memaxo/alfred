import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingItem {
	ts: number;
	kind: "stt" | "tts";
	payload: unknown;
}

const KEY = "voice:queue:v1";
const LIMIT = 50;

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

export async function enqueue(item: PendingItem): Promise<void> {
	const items = await readQueue();
	items.push(item);
	while (items.length > LIMIT) {
		items.shift();
	}
	await writeQueue(items);
}

export async function drain(processor: (item: PendingItem) => Promise<void>): Promise<void> {
	const items = await readQueue();
	if (items.length === 0) return;
	await writeQueue([]);
	for (const item of items) {
		await processor(item);
	}
}
