import { describe, test } from "bun:test";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function readAll(
  stream: ReadableStream<Uint8Array> | null
): Promise<string> {
  if (!stream) {
    return "";
  }
  const reader = stream.getReader();
  try {
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        out += decode(value);
      }
    }
    return out;
  } finally {
    reader.releaseLock();
  }
}

describe("Import safety", () => {
  test("importing TUI entrypoint exits cleanly (no leaked handles)", async () => {
    // Use a fresh environment to avoid test pollution
    const cleanEnv: Record<string, string> = {
      ALFRED_API_AUTO_INIT: "false",
      ALFRED_TUI_HEADLESS: "true",
      NODE_ENV: "test",
    };

    const proc = Bun.spawn(
      [
        "bun",
        "-e",
        'await import("./packages/tui/src/tui/index.ts"); console.log("imported");',
      ],
      {
        cwd: process.cwd(),
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: cleanEnv,
      }
    );

    const timeoutMs = 2000;
    const exit = await Promise.race([
      proc.exited.then((code) => ({ type: "exit" as const, code })),
      new Promise<{ type: "timeout" }>((r) =>
        setTimeout(() => r({ type: "timeout" }), timeoutMs)
      ),
    ]);

    const stdout = await readAll(proc.stdout);
    const stderr = await readAll(proc.stderr);

    if (exit.type === "timeout") {
      proc.kill();
      throw new Error(
        `import_timeout_after_${timeoutMs}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }

    // Main assertion: should exit quickly (not hang) - that's the key test
    // If we got here, it exited within timeout, which means no leaked handles
    // The stdout check verifies the import actually happened
    if (!stdout.includes("imported")) {
      throw new Error(
        `Import did not produce expected output\nstdout:\n${stdout}\nstderr:\n${stderr}\nexit code: ${exit.code}`
      );
    }
    // Test passes if it exits within timeout (no hangs = no leaked handles)
  });
});
