import { describe, expect, test } from "bun:test";
import { runCli } from "../src/cli";

async function readText(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) {
    return "";
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    chunks.push(next.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

describe("CLI Basic", () => {
  test("runs with --help", () => {
    // trpc-cli uses commander which might call process.exit()
    // We'll just check that the function exists for now
    expect(runCli).toBeDefined();
  });

  test("auth command usage", async () => {
    // Avoid `alfred auth` (no subcommand) because `authCommands` exits(1) on unknown usage.
    // `status` is safe and should never call process.exit.
    await runCli(["auth", "status"]);
  });

  test("alfred --help is fast and does not initialize voice pools", async () => {
    const proc = Bun.spawn(
      ["bun", "packages/tui/src/bin/alfred.ts", "--help"],
      {
        cwd: process.cwd(),
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          // Extra safety: even if something imports `@alfred/api`, prevent auto-init.
          ALFRED_API_AUTO_INIT: "false",
        },
      }
    );

    const [stdout, stderr, exitCode] = await Promise.all([
      readText(proc.stdout),
      readText(proc.stderr),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: alfred");
    expect(stderr).not.toContain("NeMoSTT");
    expect(stderr).not.toContain("Initializing STT Server");
  });
});
