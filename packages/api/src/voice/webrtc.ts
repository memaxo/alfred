export interface VoiceIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function isVoiceWebrtcEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = (env.VOICE_WEBRTC_PROTO ?? "0").toLowerCase();
  return raw === "1" || raw === "true";
}

export function getVoiceIceServers(
  env: NodeJS.ProcessEnv = process.env
): VoiceIceServer[] {
  const raw = env.VOICE_ICE_SERVERS_JSON?.trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const servers: VoiceIceServer[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const { urls } = record;
      if (
        !(
          typeof urls === "string" ||
          (Array.isArray(urls) && urls.every((u) => typeof u === "string"))
        )
      ) {
        continue;
      }
      const server: VoiceIceServer = { urls };
      if (typeof record.username === "string") {
        server.username = record.username;
      }
      if (typeof record.credential === "string") {
        server.credential = record.credential;
      }
      servers.push(server);
    }
    return servers;
  } catch {
    return [];
  }
}
