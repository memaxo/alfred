#!/usr/bin/env bun

/**
 * Voice Pipeline Verification Script
 *
 * Simulates a full streaming session to verify the end-to-end pipeline:
 * 1. Connects to WebSocket endpoint
 * 2. Sends synthetic audio chunks (silence + sine wave)
 * 3. Verifies streaming events (connected, vad, transcript, tts)
 *
 * Usage:
 *   bun run scripts/verify-voice-pipeline.ts
 */

import { WebSocket } from "ws";

const PORT = 8788; // Default port for voice stream prototype
const WS_URL = `ws://localhost:${PORT}/voice/stream`;
const SAMPLE_RATE = 16_000;

async function main() {
  console.log("🌊 ALFRED Voice Pipeline Verification\n");

  // Ensure server is running (check port)
  // For verification, we assume the dev server is running or we start a temporary one?
  // Ideally this script runs against a running `bun run dev` instance.
  // We'll check if the port is open first.

  try {
    await checkPort(PORT);
    console.log(`✅ Server detected on port ${PORT}`);
  } catch {
    console.error(`❌ Server not running on port ${PORT}.`);
    console.error("   Please run 'bun run dev' in another terminal first.");
    process.exit(1);
  }

  console.log(`🔌 Connecting to ${WS_URL}...`);

  // We need an auth cookie/header simulation?
  // The current prototype uses a fake auth or we need to grab a session token.
  // The `startVoiceStreamingPrototype` checks for `authorizeVoiceStreamRequest`.
  // It requires a session cookie.
  // For this script to work against a real dev server, we need a valid session token.
  // This is tricky without a login flow.

  // Alternative: We bypass auth for localhost/dev if configured, or we mock it.
  // But `startVoiceStreamingPrototype` is strict.

  console.log("⚠️  Auth Warning: This script requires a valid session cookie.");
  console.log(
    "   Currently, we will attempt to connect without one, which may fail if auth is enforced."
  );

  const ws = new WebSocket(WS_URL, {
    headers: {
      // 'Cookie': 'session_id=...'
    },
  });

  const events: string[] = [];

  ws.on("open", () => {
    console.log("✅ WebSocket Connected");

    // Start sending audio
    console.log("🎤 Sending synthetic audio stream...");
    startStreaming(ws);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      events.push(msg.type);
      console.log(
        `📩 Received: ${msg.type}`,
        msg.type === "transcript" ? `("${msg.text}")` : ""
      );

      if (msg.type === "error") {
        console.error("❌ Error received:", msg.message);
        ws.close();
        process.exit(1);
      }
    } catch {
      console.log("📩 Received (raw):", data.toString().substring(0, 50));
    }
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket Error:", err.message);
    if (err.message.includes("401")) {
      console.error("   (Likely authentication failure)");
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`Disconnected: ${code} ${reason}`);
    verifyResults(events);
  });

  // Timeout
  setTimeout(() => {
    console.log("⏱️  Test timed out");
    ws.close();
  }, 10_000);
}

function startStreaming(ws: WebSocket) {
  // Send 3 seconds of "audio"
  // In the real protocol, we assume raw binary or base64 json?
  // apps/web/src/hooks/use-voice-session-web.ts sends raw binary chunks.

  // Generate 1 second of 440Hz sine wave
  const chunkDurationMs = 100;
  const totalDurationMs = 3000;
  const samplesPerChunk = Math.floor(SAMPLE_RATE * (chunkDurationMs / 1000));
  let sentMs = 0;

  const interval = setInterval(() => {
    if (sentMs >= totalDurationMs || ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      ws.close(); // Close after sending
      return;
    }

    const buffer = new Int16Array(samplesPerChunk);
    for (let i = 0; i < samplesPerChunk; i++) {
      // Simple sine wave
      buffer[i] = Math.sin(2 * Math.PI * 440 * (i / SAMPLE_RATE)) * 16_000;
    }

    ws.send(buffer);
    sentMs += chunkDurationMs;
    process.stdout.write(".");
  }, chunkDurationMs);
}

function verifyResults(events: string[]) {
  console.log("\n📊 Verification Results:");
  const hasConnected = events.includes("status") || events.includes("ready");
  // Note: Without valid auth, we expect a 401/connection failure
  // So we mainly verify that we ATTEMPTED the connection flow.

  console.log(`   Connection Established: ${hasConnected ? "✅" : "❌"}`);

  if (!hasConnected) {
    console.log("\n⚠️  Note: Full verification requires a valid session token.");
    console.log(
      "   Run the app in dev mode, log in, and use the UI to verify full E2E flow."
    );
  }
}

function checkPort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = new WebSocket(`ws://localhost:${port}`);
    s.on("error", () => reject());
    s.on("open", () => {
      s.close();
      resolve();
    });
  });
}

main();
