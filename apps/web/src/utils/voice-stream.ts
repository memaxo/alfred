const STREAM_PATH = "/voice/stream";
const DEFAULT_PORT = "8788";

export function getVoiceStreamUrl(): string | null {
  const direct = import.meta.env.VITE_VOICE_STREAMING_URL?.trim();
  if (direct) {
    return direct.replace(/\/$/, "") + STREAM_PATH;
  }
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const url = new URL(window.location.origin);
    const port =
      import.meta.env.VITE_VOICE_STREAMING_PORT?.trim() || DEFAULT_PORT;
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.port = port;
    url.pathname = STREAM_PATH;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}
