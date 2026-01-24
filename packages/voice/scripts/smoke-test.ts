import { spawn } from "bun";
import { join } from "node:path";

const scriptPath = join(process.cwd(), "packages/voice/python/tts");
const venvPython = join(process.cwd(), "packages/voice/.venv/bin/python");

async function runSmokeTest() {
  console.log("🚀 Starting TTS Smoke Test...");
  console.log(`Script: ${scriptPath}`);
  console.log(`Python: ${venvPython}`);

  const proc = spawn({
    cmd: [venvPython, scriptPath],
    cwd: join(process.cwd(), "packages/voice"),
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });

  const stdoutReader = proc.stdout.getReader();
  const stderrReader = proc.stderr.getReader();
  const decoder = new TextDecoder();

  // Stream stderr to console
  (async () => {
    try {
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) {
          break;
        }
        process.stderr.write(decoder.decode(value));
      }
    } catch (error) {
      console.error("Stderr read error:", error);
    }
  })();

  let buffer = "";
  const _requestId = 0;

  // Helper to send JSON
  // oxlint-disable noExplicitAny: Smoke test helper
  const send = (msg: any) => {
    const str = `${JSON.stringify(msg)}\n`;
    proc.stdin.write(str);
    proc.stdin.flush();
  };

  try {
    while (true) {
      const { done, value } = await stdoutReader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const msg = JSON.parse(line);

          if (msg.type === "status" && msg.id === "init") {
            console.log(`[STATUS] ${msg.payload.message}`);
          }

          if (
            msg.type === "status" &&
            msg.payload.message === "TTS server ready"
          ) {
            console.log(`✅ Server Ready on Device: ${msg.payload.device}`);
            console.log(`   Startup Time: ${msg.payload.startup_time}s`);

            // Send synthesis request
            console.log("Sending synthesis request...");
            const _t0 = Date.now();
            send({
              id: "test-1",
              payload: {
                text: "This is a smoke test for the dual backend architecture.",
                voice:
                  "Realistic male voice in the 30s age with american accent.",
                streaming: true,
              },
              type: "synthesize",
            });
          }

          if (msg.type === "audio") {
            if (msg.id === "test-1") {
              process.stdout.write("."); // Progress dot
            }
            if (msg.payload.isFinal) {
              console.log("\n✅ Audio Received!");

              if (msg.id === "test-1") {
                // Test Caching
                console.log("Testing Cache...");
                const _t1 = Date.now();
                send({
                  id: "test-2",
                  payload: {
                    text: "This is a smoke test for the dual backend architecture.",
                    voice:
                      "Realistic male voice in the 30s age with american accent.",
                    streaming: false,
                  },
                  type: "synthesize",
                });
              }
            }
            if (msg.id === "test-2" && msg.payload.isFinal) {
              console.log("✅ Cached Audio Received!");
              send({ type: "shutdown" });
            }
          }

          if (msg.type === "error") {
            console.error(`❌ Error: ${msg.payload.message}`);
            if (msg.payload.traceback) {
              console.error(msg.payload.traceback);
            }
            process.exit(1);
          }
        } catch {
          console.error("Failed to parse line:", line);
        }
      }
    }
  } catch (error) {
    console.error("Stream error:", error);
  }

  console.log("Smoke test complete.");
}

runSmokeTest();
