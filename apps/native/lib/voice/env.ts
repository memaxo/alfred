const STREAM_PATH = "/voice/stream";
const DEFAULT_PORT = "8788";
const TRAILING_SLASH_REGEX = /\/$/;

export function getVoiceStreamUrl(): string | null {
  const direct = process.env.EXPO_PUBLIC_VOICE_STREAM_URL?.trim();
  if (direct) {
    return direct.replace(TRAILING_SLASH_REGEX, "") + STREAM_PATH;
  }
  const base = process.env.EXPO_PUBLIC_SERVER_URL;
  if (!base) {
    return null;
  }
  try {
    const url = new URL(base);
    const port =
      process.env.EXPO_PUBLIC_VOICE_STREAM_PORT?.trim() || DEFAULT_PORT;
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.port = port;
    url.pathname = STREAM_PATH;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}
