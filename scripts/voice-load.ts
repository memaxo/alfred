/**
 * Lightweight load harness for the realtime voice WebSocket endpoint.
 *
 * This is intentionally simple: it does not require Playwright, and it can run
 * against a locally running ALFRED instance (or any environment) by pointing at
 * the `/voice/stream` WS URL and providing auth headers/cookies.
 *
 * Modes:
 * - handshake: connect → start → wait session_started → close
 * - stt: connect → start → stream audio chunks → close
 * - full: connect → start → stream audio chunks → stop → wait tts_complete → close
 */

import { logger } from "@alfred/logger";

type LoadMode = "handshake" | "stt" | "full";

type LoadConfig = {
  url: string;
  mode: LoadMode;
  concurrency: number;
  durationMs: number;
  chunkBytes: number;
  chunkIntervalMs: number;
  headers: Record<string, string>;
};

type Counters = {
  connected: number;
  failed: number;
  sessionStarted: number;
  finalTranscript: number;
  ttsComplete: number;
  errors: number;
};

function intEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function jsonHeadersEnv(): Record<string, string> {
  const raw = process.env.VOICE_LOAD_HEADERS_JSON?.trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function buildConfig(): LoadConfig {
  const url = process.env.VOICE_LOAD_URL ?? "ws://localhost:8788/voice/stream";
  const mode = (process.env.VOICE_LOAD_MODE ?? "handshake") as LoadMode;
  const concurrency = intEnv("VOICE_LOAD_CONCURRENCY", 10);
  const durationMs = intEnv("VOICE_LOAD_DURATION_MS", 5_000);
  const chunkIntervalMs = intEnv("VOICE_LOAD_CHUNK_INTERVAL_MS", 50);
  const chunkBytes = intEnv("VOICE_LOAD_CHUNK_BYTES", 3200); // 100ms @ 16kHz PCM16

  const headers = jsonHeadersEnv();
  const cookie = process.env.VOICE_LOAD_COOKIE?.trim();
  if (cookie) {
    headers.cookie = cookie;
  }

  return {
    url,
    mode,
    concurrency,
    durationMs,
    chunkBytes: Math.max(2, chunkBytes - (chunkBytes % 2)),
    chunkIntervalMs,
    headers,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function runClient(cfg: LoadConfig, i: number, counters: Counters) {
  const sessionId = `load-${i}-${Math.random().toString(16).slice(2)}`;
  const startPayload = JSON.stringify({
    _: "start",
    sessionId,
    language: "en",
    codec: "pcm",
    inputMimeType: "audio/raw;codec=pcm_s16le;rate=16000",
  });

  let sawStarted = false;
  let sawFinal = false;
  let sawTts = false;

  const ws = new WebSocket(cfg.url, {
    headers: cfg.headers,
  });

  let closed = false;
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    try {
      ws.close();
    } catch {
      // ignore
    }
  };

  ws.addEventListener("open", () => {
    counters.connected += 1;
    try {
      ws.send(startPayload);
    } catch {
      counters.failed += 1;
      close();
    }
  });

  ws.addEventListener("error", () => {
    counters.failed += 1;
    close();
  });

  ws.addEventListener("message", (ev) => {
    const raw = typeof ev.data === "string" ? ev.data : null;
    if (!raw) {
      return;
    }
    try {
      const msg = JSON.parse(raw) as { _?: unknown; message?: unknown };
      const t = typeof msg._ === "string" ? msg._ : null;
      if (t === "session_started") {
        sawStarted = true;
        counters.sessionStarted += 1;
        if (cfg.mode === "handshake") {
          close();
        }
      } else if (t === "final_transcript") {
        sawFinal = true;
        counters.finalTranscript += 1;
      } else if (t === "tts_complete") {
        sawTts = true;
        counters.ttsComplete += 1;
        close();
      } else if (t === "error") {
        counters.errors += 1;
        if (typeof msg.message === "string") {
          logger.warn("voice_load_error", { sessionId, message: msg.message });
        }
      }
    } catch {
      // ignore
    }
  });

  // Wait for session_started (or timeout), then optionally stream audio.
  const waitStartMs = 2_000;
  const startAt = Date.now();
  while (!sawStarted && Date.now() - startAt < waitStartMs && ws.readyState === 0) {
    await sleep(10);
  }
  while (!sawStarted && Date.now() - startAt < waitStartMs && ws.readyState === 1) {
    await sleep(10);
  }

  if (cfg.mode === "stt" || cfg.mode === "full") {
    const audio = new Uint8Array(cfg.chunkBytes);
    const until = Date.now() + cfg.durationMs;
    while (Date.now() < until && ws.readyState === 1) {
      try {
        ws.send(audio);
      } catch {
        counters.failed += 1;
        close();
        break;
      }
      await sleep(cfg.chunkIntervalMs);
    }
  }

  if (cfg.mode === "full" && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify({ _: "stop" }));
    } catch {
      counters.failed += 1;
      close();
    }
  }

  // If full mode, wait for tts_complete; otherwise close.
  if (cfg.mode !== "full") {
    close();
  } else {
    const waitTtsMs = 15_000;
    const t0 = Date.now();
    while (!sawTts && Date.now() - t0 < waitTtsMs && ws.readyState === 1) {
      await sleep(25);
    }
    close();
  }

  // Avoid unused flags in case we extend reporting later.
  void sawFinal;
}

async function main() {
  const cfg = buildConfig();
  const counters: Counters = {
    connected: 0,
    failed: 0,
    sessionStarted: 0,
    finalTranscript: 0,
    ttsComplete: 0,
    errors: 0,
  };

  logger.info("voice_load_config", cfg);

  const startedAt = Date.now();
  const workers: Promise<void>[] = [];
  for (let i = 0; i < cfg.concurrency; i += 1) {
    workers.push(runClient(cfg, i, counters));
    // Small stagger avoids thundering herds when testing rate limits.
    await sleep(5);
  }
  await Promise.allSettled(workers);

  const elapsedMs = Date.now() - startedAt;
  logger.info("voice_load_summary", { elapsedMs, ...counters });
}

if (import.meta.main) {
  await main();
}

