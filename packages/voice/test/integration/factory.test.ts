import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { spawn } from "bun";

// Low-level integration test for the Python factory
describe.skip("TTS Factory Integration (skipped: causes C++ exception in Bun runner)", () => {
  const scriptPath = join(process.cwd(), "packages/voice/python/tts");
  const venvPython = join(process.cwd(), "packages/voice/.venv/bin/python");

  it("should launch and report correct backend", async () => {
    console.log("Spawning:", venvPython, scriptPath);
    const proc = spawn({
      cmd: [venvPython, scriptPath],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let backendLoaded = false;

    // Wait for "ready" status
    try {
      const timeout = setTimeout(() => {
        proc.kill();
        throw new Error("Timeout waiting for server ready");
      }, 60_000); // Increased timeout for model loading

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          console.log("Integration stdout:", line);
          try {
            const msg = JSON.parse(line);
            if (
              msg.type === "status" &&
              msg.payload.message === "TTS server ready"
            ) {
              console.log("Server ready:", msg.payload);
              // Expect "mlx" on macOS if dependencies are installed
              if (process.platform === "darwin") {
                // It might fallback to mps if mlx not found/working
                expect(["mlx", "mps"]).toContain(msg.payload.device);
              } else {
                expect(["cuda", "cpu"]).toContain(msg.payload.device);
              }
              backendLoaded = true;
              clearTimeout(timeout);
              proc.kill();
              break;
            }
          } catch (e) {
            // ignore parse errors
          }
        }
        if (backendLoaded) break;
      }
    } catch (e) {
      proc.kill();
      throw e;
    }

    await proc.exited;
    expect(backendLoaded).toBe(true);
  }, 60_000);
});
