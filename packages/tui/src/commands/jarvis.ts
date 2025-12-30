import type { UIMessage } from "@alfred/type/stream";
import { playAudioBase64 } from "../cli/audio";
import { createCliContext } from "../cli/context";

function writeStdout(text: string): void {
  process.stdout.write(text);
}

function writeStderr(text: string): void {
  process.stderr.write(text);
}

function isSpeakDisabled(args: string[]): boolean {
  if (process.env.ALFRED_TUI_NO_AUDIO === "1") {
    return true;
  }
  return args.includes("--no-speak");
}

function stripFlags(args: string[]): string[] {
  return args.filter((a) => !a.startsWith("--"));
}

async function speakText(
  ctx: Awaited<ReturnType<typeof createCliContext>>,
  text: string
) {
  const { appRouter } = await import("@alfred/api/router");
  const caller = appRouter.createCaller(ctx);
  const audio = await caller.voice.ttsSynthesize({
    text,
    voice: "alloy",
    format: "wav",
  });
  if (!audio?.audioBase64) {
    return;
  }
  await playAudioBase64({
    audioBase64: audio.audioBase64,
    mimeType: audio.mimeType,
  });
}

async function selectJarvisGreeting(): Promise<string> {
  const { selectGreeting } = await import(
    "@alfred/agent/assistant/src/jarvis-persona"
  );
  return selectGreeting(new Date().getHours());
}

async function selectJarvisStatusOpener(): Promise<string> {
  const { selectTransition } = await import(
    "@alfred/agent/assistant/src/jarvis-persona"
  );
  return selectTransition("status");
}

async function fetchHealthSummary(): Promise<{
  overall: "nominal" | "degraded" | "critical" | "unknown";
  line: string;
}> {
  const baseUrl = process.env.ALFRED_WEB_URL ?? "http://localhost:3000";
  try {
    const [healthRes, depsRes] = await Promise.all([
      fetch(`${baseUrl}/healthz`),
      fetch(`${baseUrl}/healthz/deps`),
    ]);

    const apiOk = healthRes.ok;
    const depsOk = depsRes.ok;

    let redis = "unknown" as "ok" | "unavailable" | "unknown";
    try {
      const body = (await depsRes.json()) as {
        redis?: "ok" | "unavailable";
      } | null;
      redis = body?.redis ?? "unknown";
    } catch {
      redis = "unknown";
    }

    if (!apiOk) {
      return { overall: "critical", line: "API unreachable." };
    }
    if (!depsOk) {
      return { overall: "critical", line: "Dependency health check failing." };
    }
    if (redis !== "ok") {
      return { overall: "degraded", line: "Redis degraded." };
    }
    return { overall: "nominal", line: "All systems nominal." };
  } catch {
    return { overall: "unknown", line: "Unable to reach health endpoints." };
  }
}

export async function askCommand(args: string[]): Promise<void> {
  const speakDisabled = isSpeakDisabled(args);
  const query = stripFlags(args).join(" ").trim();
  if (!query) {
    writeStderr(
      `${`
Usage: alfred ask "<query>" [--no-speak]

Runs a quick JARVIS-styled assistant query (prints text; optionally speaks via local TTS).
`.trim()}\n`
    );
    return;
  }

  const ctx = await createCliContext();
  if (!ctx.session?.user?.id) {
    throw new Error("session_required");
  }

  const { appRouter } = await import("@alfred/api/router");
  const caller = appRouter.createCaller(ctx);
  const message: UIMessage = {
    id: `cli-${Date.now()}`,
    role: "user",
    parts: [{ type: "text", text: query }],
  };
  const result = await caller.assistant.generate({
    messages: [message] as unknown[],
  });
  const text = (result?.text ?? "").trim();
  writeStdout(`${text}\n`);
  if (!speakDisabled && text) {
    await speakText(ctx, text);
  }
}

export async function jarvisCommands(args: string[]): Promise<void> {
  const sub = args[0];
  const speakDisabled = isSpeakDisabled(args);

  if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
    writeStdout(
      `${`
Usage: alfred jarvis <command> [options]

Commands:
  greet            Time-appropriate greeting
  status           Speak/print system health (uses ALFRED_WEB_URL or http://localhost:3000)
  ask <query>      Quick assistant query (alias: alfred ask ...)

Options:
  --no-speak       Print text only (do not synthesize/play audio)

Environment:
  ALFRED_WEB_URL         Base URL for health checks (default: http://localhost:3000)
  ALFRED_TUI_NO_AUDIO=1  Disable audio synthesis/playback entirely
`.trim()}\n`
    );
    return;
  }

  if (sub === "ask") {
    return await askCommand(args.slice(1));
  }

  switch (sub) {
    case "greet": {
      const greeting = await selectJarvisGreeting();
      writeStdout(`${greeting}\n`);
      if (!speakDisabled) {
        const ctx = await createCliContext();
        if (!ctx.session?.user?.id) {
          throw new Error("session_required");
        }
        await speakText(ctx, greeting);
      }
      return;
    }
    case "status": {
      const opener = await selectJarvisStatusOpener();
      const health = await fetchHealthSummary();
      const line = `${opener} ${health.line}`.trim();
      writeStdout(`${line}\n`);
      if (!speakDisabled) {
        const ctx = await createCliContext();
        if (!ctx.session?.user?.id) {
          throw new Error("session_required");
        }
        await speakText(ctx, line);
      }
      return;
    }
    default: {
      throw new Error("tui_jarvis_command_invalid");
    }
  }
}
