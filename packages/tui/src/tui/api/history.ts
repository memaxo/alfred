import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const HISTORY_DIR = join(homedir(), ".alfred", "tui");
const HISTORY_FILE = join(HISTORY_DIR, "chat_history.json");

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  try {
    await mkdir(HISTORY_DIR, { recursive: true });
    await writeFile(HISTORY_FILE, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
}

export async function loadChatHistory(): Promise<ChatMessage[]> {
  try {
    const content = await readFile(HISTORY_FILE, "utf8");
    return JSON.parse(content) as ChatMessage[];
  } catch {
    // File might not exist yet
    return [];
  }
}
