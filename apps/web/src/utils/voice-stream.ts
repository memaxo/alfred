const STREAM_PATH = "/voice/stream";

export function getVoiceStreamUrl(opts?: {
  origin?: string;
  directUrl?: string;
  port?: string;
}): string | null {
  const direct = (
    opts?.directUrl ?? import.meta.env.VITE_VOICE_STREAMING_URL
  )?.trim();
  if (direct) {
    return direct.replace(/\/$/, "") + STREAM_PATH;
  }
  const origin =
    opts?.origin ??
    (typeof window !== "undefined" ? window.location.origin : null);
  if (!origin) {
    return null;
  }
  try {
    const url = new URL(origin);
    const port = (
      opts?.port ?? import.meta.env.VITE_VOICE_STREAMING_PORT
    )?.trim();
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    if (port) {
      url.port = port;
    }
    url.pathname = STREAM_PATH;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}
