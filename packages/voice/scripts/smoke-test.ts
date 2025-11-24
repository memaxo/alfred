import { join } from "node:path";
import { spawn } from "bun";

const scriptPath = join(process.cwd(), "packages/voice/python/tts");
const venvPython = join(process.cwd(), "packages/voice/.venv/bin/python");

async function runSmokeTest() {
  console.log("🚀 Starting TTS Smoke Test...");
  console.log(`Script: ${scriptPath}`);
  console.log(`Python: ${venvPython}`);

  const proc = spawn({
    cmd: [venvPython, scriptPath],
    cwd: join(process.cwd(), "packages/voice"),
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutReader = proc.stdout.getReader();
  const stderrReader = proc.stderr.getReader();
  const decoder = new TextDecoder();

  // Stream stderr to console
  (async () => {
    try {
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        process.stderr.write(decoder.decode(value));
      }
    } catch (e) {
      console.error("Stderr read error:", e);
    }
  })();

  let buffer = "";
  const requestId = 0;

  // Helper to send JSON
  const send = (msg: any) => {
    const str = JSON.stringify(msg) + "\n";
    proc.stdin.write(str);
    proc.stdin.flush();
  };

  try {
    while (true) {
      const { done, value } = await stdoutReader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

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
            const t0 = Date.now();
            send({
              id: "test-1",
              type: "synthesize",
              payload: {
                text: "This is a smoke test for the dual backend architecture.",
                voice:
                  "Realistic male voice in the 30s age with american accent.",
                streaming: true,
              },
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
                const t1 = Date.now();
                send({
                  id: "test-2",
                  type: "synthesize",
                  payload: {
                    text: "This is a smoke test for the dual backend architecture.",
                    voice:
                      "Realistic male voice in the 30s age with american accent.",
                    streaming: false,
                  },
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
        } catch (e) {
          console.error("Failed to parse line:", line);
        }
      }
    }
  } catch (e) {
    console.error("Stream error:", e);
  }

  console.log("Smoke test complete.");
}

runSmokeTest();
