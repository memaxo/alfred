import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import path from "node:path";
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
    // Run as subprocess to avoid any commander/process.exit behavior affecting Bun tests.
    const bin = path.join(import.meta.dir, "../src/bin/alfred.ts");
    const proc = Bun.spawn(["bun", bin, "auth", "status"], {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ALFRED_API_AUTO_INIT: "false",
      },
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      readText(proc.stdout),
      readText(proc.stderr),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).not.toContain("tui_cli_failed");
    expect(stderr).not.toContain("tui_auth_command_invalid");
    expect(stdout).toBeDefined();
  });

  test("alfred --help is fast and does not initialize voice pools", async () => {
    const bin = path.join(import.meta.dir, "../src/bin/alfred.ts");
    const proc = Bun.spawn(["bun", bin, "--help"], {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        // Extra safety: even if something imports `@alfred/api`, prevent auto-init.
        ALFRED_API_AUTO_INIT: "false",
      },
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      readText(proc.stdout),
      readText(proc.stderr),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("Available subcommands");
    expect(stderr).not.toContain("NeMoSTT");
    expect(stderr).not.toContain("Initializing STT Server");
  });

  test("jarvis greet prints without speaking", async () => {
    const bin = path.join(import.meta.dir, "../src/bin/alfred.ts");
    const proc = Bun.spawn(["bun", bin, "jarvis", "greet", "--no-speak"], {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ALFRED_API_AUTO_INIT: "false",
        ALFRED_TUI_NO_AUDIO: "1",
      },
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      readText(proc.stdout),
      readText(proc.stderr),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).not.toContain("tui_jarvis_command_invalid");
    expect(stdout).toContain("Sir");
  });

  test("jarvis status prints without speaking", async () => {
    const bin = path.join(import.meta.dir, "../src/bin/alfred.ts");
    const proc = Bun.spawn(["bun", bin, "jarvis", "status", "--no-speak"], {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ALFRED_API_AUTO_INIT: "false",
        ALFRED_TUI_NO_AUDIO: "1",
        ALFRED_WEB_URL: "http://localhost:0",
      },
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      readText(proc.stdout),
      readText(proc.stderr),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).not.toContain("tui_jarvis_command_invalid");
    expect(stdout.length).toBeGreaterThan(0);
  });
});
