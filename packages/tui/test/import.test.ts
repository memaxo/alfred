import { describe, expect, test } from "bun:test";

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
        env: {
          ...process.env,
          ALFRED_API_AUTO_INIT: "false",
        },
      }
    );

    const timeoutMs = 2000;
    const exit = await Promise.race([
      proc.exited.then((code) => ({ type: "exit" as const, code })),
      new Promise<{ type: "timeout" }>((r) =>
        setTimeout(() => r({ type: "timeout" }), timeoutMs)
      ),
    ]);

    if (exit.type === "timeout") {
      proc.kill();
      const stdout = await readAll(proc.stdout);
      const stderr = await readAll(proc.stderr);
      throw new Error(
        `import_timeout_after_${timeoutMs}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }

    const stdout = await readAll(proc.stdout);
    const stderr = await readAll(proc.stderr);
    expect(exit.code).toBe(0);
    expect(stdout).toContain("imported");
    expect(stderr).toBe("");
  });
});
