import { describe, expect, test } from "bun:test";
import path from "node:path";

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

async function readUntil(
  stream: ReadableStream<Uint8Array> | null,
  condition: (text: string) => boolean,
  timeout = 5000
) {
  if (!stream) {
    return "";
  }
  const reader = stream.getReader();
  try {
    let accumulated = "";
    const decoder = new TextDecoder();
    const startTime = Date.now();

    for (;;) {
      if (Date.now() - startTime > timeout) {
        // console.log("ACCUMULATED:", stripAnsi(accumulated));
        throw new Error(
          `Timeout waiting for condition. Accumulated: ${stripAnsi(accumulated)}`
        );
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      accumulated += decoder.decode(value);
      if (condition(accumulated)) {
        return accumulated;
      }
    }
    return accumulated;
  } finally {
    reader.releaseLock();
  }
}

describe("TUI E2E", () => {
  const bin = path.join(import.meta.dir, "../src/bin/alfred.ts");

  const commonEnv = {
    ...process.env,
    ALFRED_API_AUTO_INIT: "false",
    ALFRED_AUTH_BYPASS: "true",
    ALFRED_TUI_SKIP_INTRO: "true",
    TERM: "xterm-256color",
    COLUMNS: "120",
    LINES: "40",
  };

  test("Dashboard launches and displays core sections", async () => {
    const proc = Bun.spawn(["bun", bin, "tui", "--headless"], {
      cwd: process.cwd(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: commonEnv,
    });

    try {
      // Wait for the dashboard to render
      const output = await readUntil(proc.stdout, (text) => {
        const plain = stripAnsi(text);
        return plain.includes("Cognitive") && plain.includes("Workflow");
      });

      const plain = stripAnsi(output);
      expect(plain).toContain("Cognitive");
      expect(plain).toContain("Workflow");

      // Test navigation: send 'tab' to switch focus
      proc.stdin.write("\t");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Test quit: send 'q'
      proc.stdin.write("q");

      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      proc.kill();
    }
  });

  test("Debug mode launches and shows hints", async () => {
    const proc = Bun.spawn(["bun", bin, "tui", "debug", "--headless"], {
      cwd: process.cwd(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: commonEnv,
    });

    try {
      // Wait for debug mode to render
      const output = await readUntil(proc.stdout, (text) => {
        const plain = stripAnsi(text);
        return (
          plain.includes("ALFRED Debug") &&
          plain.includes("Refresh") &&
          plain.includes("Quit")
        );
      });

      const plain = stripAnsi(output);
      expect(plain).toContain("ALFRED Debug");
      expect(plain).toContain("Refresh");
      expect(plain).toContain("Quit");

      // Quit debug mode via 'q'
      proc.stdin.write("q");

      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      proc.kill();
    }
  });

  test("Chat mode launches", async () => {
    const proc = Bun.spawn(["bun", bin, "tui", "chat", "--headless"], {
      cwd: process.cwd(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: commonEnv,
    });

    try {
      const output = await readUntil(proc.stdout, (text) => {
        const plain = stripAnsi(text);
        return plain.includes("ALFRED Chat");
      });

      const plain = stripAnsi(output);
      expect(plain).toContain("ALFRED Chat");

      // Chat mode exits on Esc
      proc.stdin.write("\x1b");
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      proc.kill();
    }
  });

  test("Help opens and returns to dashboard", async () => {
    const proc = Bun.spawn(["bun", bin, "tui", "--headless"], {
      cwd: process.cwd(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...commonEnv,
        ALFRED_TUI_MAX_TRANSITIONS: "10",
      },
    });

    try {
      // Wait for dashboard
      await readUntil(
        proc.stdout,
        (text) => {
          const plain = stripAnsi(text);
          return plain.includes("Cognitive") && plain.includes("Workflows");
        },
        8000
      );

      // Open help
      proc.stdin.write("?");

      // Help screen should render
      await readUntil(
        proc.stdout,
        (text) => {
          const plain = stripAnsi(text);
          return (
            plain.includes("ALFRED Help") &&
            plain.includes("Keyboard Shortcuts")
          );
        },
        8000
      );

      // Back to dashboard via Esc
      proc.stdin.write("\x1b");

      await readUntil(
        proc.stdout,
        (text) => {
          const plain = stripAnsi(text);
          return plain.includes("Cognitive") && plain.includes("Workflows");
        },
        8000
      );

      proc.stdin.write("q");
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      proc.kill();
    }
  });

  test("Can switch dashboard -> debug -> dashboard (bounded transitions)", async () => {
    const proc = Bun.spawn(["bun", bin, "tui", "--headless"], {
      cwd: process.cwd(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...commonEnv,
        ALFRED_TUI_MAX_TRANSITIONS: "10",
      },
    });

    try {
      // Wait for dashboard
      await readUntil(
        proc.stdout,
        (text) => {
          const plain = stripAnsi(text);
          return plain.includes("Cognitive") && plain.includes("Workflows");
        },
        8000
      );

      // Ctrl+D to open debug mode
      proc.stdin.write("\x04");

      // Wait for debug mode
      await readUntil(
        proc.stdout,
        (text) => {
          const plain = stripAnsi(text);
          return plain.includes("ALFRED Debug") && plain.includes("Refresh");
        },
        8000
      );

      // Quit debug mode -> back to dashboard
      proc.stdin.write("q");

      // Dashboard should be visible again
      await readUntil(
        proc.stdout,
        (text) => {
          const plain = stripAnsi(text);
          return plain.includes("Cognitive") && plain.includes("Workflows");
        },
        8000
      );

      // Quit dashboard
      proc.stdin.write("q");

      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    } finally {
      proc.kill();
    }
  });

  test("MAX_TRANSITIONS exits with error", async () => {
    const proc = Bun.spawn(["bun", bin, "tui", "--headless"], {
      cwd: process.cwd(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...commonEnv,
        ALFRED_TUI_MAX_TRANSITIONS: "1",
      },
    });

    try {
      // Wait for dashboard to show at least once
      await readUntil(
        proc.stdout,
        (text) => {
          const plain = stripAnsi(text);
          return plain.includes("Cognitive") && plain.includes("Workflows");
        },
        8000
      );

      // Force one transition (dashboard -> debug) which should exceed max=1 on next loop
      proc.stdin.write("\x04");

      const stderr = await readUntil(
        proc.stderr,
        (text) => {
          const plain = stripAnsi(text);
          return plain.includes("tui_max_transitions");
        },
        8000
      );

      expect(stripAnsi(stderr)).toContain("tui_max_transitions");
      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    } finally {
      proc.kill();
    }
  });
});
