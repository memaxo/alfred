import { spawn } from "bun";

// Function to find a free port
async function getFreePort(startPort = 3100, endPort = 3200): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    try {
      const server = Bun.serve({
        port,
        hostname: "127.0.0.1",
        fetch: () => new Response("ping"),
      });
      server.stop();
      return port;
    } catch (err) {
        // Port likely in use, continue
        continue;
    }
  }
  throw new Error(`No free ports found between ${startPort} and ${endPort}`);
}

async function run() {
  try {
    const port = await getFreePort();
    console.log(`[E2E] Found free port: ${port}`);

    // Pass all args after the script name to Playwright
    const args = process.argv.slice(2);
    
    const proc = spawn(["bunx", "playwright", "test", ...args], {
        env: {
            ...process.env,
            MINDSCAPE_PORT: port.toString(),
            MINDSCAPE_HOST: "127.0.0.1",
            NODE_ENV: "test"
        },
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit"
    });

    const exitCode = await proc.exited;
    process.exit(exitCode);

  } catch (error) {
    console.error("[E2E] Failed to start tests:", error);
    process.exit(1);
  }
}

run();
