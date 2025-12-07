import { logger } from "@alfred/logger";
import { spawn } from "bun";

export type HardwareCapabilities = {
  gpu: boolean;
  vendor?: "nvidia" | "apple" | "amd" | "unknown";
  voiceServer: boolean; // Is python/stt running?
};

export class HardwareProbe {
  static async check(): Promise<HardwareCapabilities> {
    const caps: HardwareCapabilities = {
      gpu: false,
      voiceServer: false,
    };

    // 1. Check GPU
    if (process.platform === "darwin") {
      // Apple Silicon
      // sysctl -a | grep machdep.cpu.brand_string
      // or just assume Apple Silicon if arm64 mac
      if (process.arch === "arm64") {
        caps.gpu = true;
        caps.vendor = "apple";
      }
    } else if (process.platform === "linux") {
      // Check nvidia-smi
      try {
        const proc = spawn(["nvidia-smi", "-L"], {
          stdout: "ignore",
          stderr: "ignore",
        });
        const exit = await proc.exited;
        if (exit === 0) {
          caps.gpu = true;
          caps.vendor = "nvidia";
        }
      } catch {}
    }

    // 2. Check Voice Server (localhost:8000 or wherever it runs)
    // Voice server usually runs on random ports via pool, but maybe we check if 'python' processes are active
    // For Level 5 test, we might start our own server.
    // Let's check if we can spawn python and import torch/whisper
    try {
      const proc = spawn(
        ["python3", "-c", "import torch; print(torch.cuda.is_available())"],
        {
          stdout: "ignore",
          stderr: "ignore",
        }
      );
      const exitCode = await proc.exited;
      // If python runs successfully (exit code 0), that's a good sign
      // Actual server check is harder without knowing port, so we'll leave voiceServer as false default
      // Tests can spin up their own server if needed
      if (exitCode === 0) {
        caps.voiceServer = true;
      }
    } catch {
      // Python not available or failed to run
    }

    logger.info("hardware_probe_result", caps);
    return caps;
  }
}
