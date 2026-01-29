import { describe, expect, it } from "bun:test";
import { join } from "node:path";

async function readAll(
  stream: ReadableStream<Uint8Array> | null,
  onChunk: (text: string) => void
): Promise<void> {
  if (!stream) {
    return;
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      onChunk(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
}

describe("dev-noise", () => {
  it(
    "starts and stops vite dev without ERROR logs for missing optional deps",
    async () => {
      const webDir = join(import.meta.dir, "..", "..", "..");
      const preferredPort = 31_000 + (process.pid % 10_000);

      let out = "";
      const append = (chunk: string) => {
        out += chunk;
        if (out.length > 250_000) {
          out = out.slice(-250_000);
        }
      };

      const proc = Bun.spawn(
        ["bunx", "vite", "dev", "--port", String(preferredPort)],
        {
          cwd: webDir,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            // Quiet-by-default baseline.
            VOICE_PROVIDER: "openai",
            ENABLE_DB_RECOVERY: "0",
            ENABLE_LEARNING_WORKER: "0",
            // Keep tests deterministic + light.
            VITE_TEST_MODE: "true",
            NODE_ENV: "development",
            // Avoid accidental DB probing via inherited env.
            DATABASE_URL: "",
          },
        }
      );

      const stdoutTask = readAll(proc.stdout, append);
      const stderrTask = readAll(proc.stderr, append);

      const ready = async (): Promise<void> => {
        const deadlineMs = Date.now() + 60_000;
        while (Date.now() < deadlineMs) {
          if (
            (out.includes("VITE v") && out.includes("ready in")) ||
            out.includes("Local:")
          ) {
            return;
          }
          await Bun.sleep(50);
        }
        throw new Error(`vite_dev_not_ready\n\n${out}`);
      };

      try {
        await Promise.race([
          ready(),
          proc.exited.then((code) => {
            throw new Error(
              `vite_dev_exited_early:${code ?? "null"}\n\n${out}`
            );
          }),
        ]);
      } finally {
        try {
          proc.kill("SIGINT");
        } catch {
          // ignore
        }
      }

      await Promise.race([
        proc.exited,
        Bun.sleep(10_000).then(() => {
          try {
            proc.kill("SIGKILL");
          } catch {
            // ignore
          }
        }),
      ]);

      await Promise.all([stdoutTask, stderrTask]);

      // Must not reintroduce known noise.
      const forbidden = [
        "TSConfckParseError",
        "The above dynamic import cannot be analyzed by Vite",
        "[tanstack-router] These exports",
        "Vite module runner has been closed",
        "voice_pools_init_failed",
        "can't open file",
        '"level":"error"',
      ];

      const offenders = forbidden.filter((needle) => out.includes(needle));
      expect(offenders).toEqual([]);
    },
    { timeout: 60_000 }
  );
});
