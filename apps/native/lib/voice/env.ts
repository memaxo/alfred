const STREAM_PATH = "/voice/stream";
const TRAILING_SLASH_REGEX = /\/$/;

export function getVoiceStreamUrl(baseUrl?: string | null): string | null {
  const direct = process.env.EXPO_PUBLIC_VOICE_STREAM_URL?.trim();
  if (direct) {
    return direct.replace(TRAILING_SLASH_REGEX, "") + STREAM_PATH;
  }
  const base =
    typeof baseUrl === "string" && baseUrl.trim().length > 0
      ? baseUrl.trim()
      : process.env.EXPO_PUBLIC_SERVER_URL;
  if (!base) {
    return null;
  }
  try {
    const url = new URL(base);
    const port = process.env.EXPO_PUBLIC_VOICE_STREAM_PORT?.trim();
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

export function getVoiceStreamUrlForTest(opts: {
  directUrl?: string;
  baseUrl?: string;
  port?: string;
}): string | null {
  if (opts.directUrl && opts.directUrl.trim().length > 0) {
    return (
      opts.directUrl.trim().replace(TRAILING_SLASH_REGEX, "") + STREAM_PATH
    );
  }
  if (!opts.baseUrl) {
    return null;
  }
  try {
    const url = new URL(opts.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    if (opts.port && opts.port.trim().length > 0) {
      url.port = opts.port.trim();
    }
    url.pathname = STREAM_PATH;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}
