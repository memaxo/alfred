import { accessSync, constants as fsConstants, statSync } from "node:fs";
import { join, delimiter as pathDelimiter } from "node:path";
import { type Subprocess, spawn } from "bun";
import { IPCBridge, type IPCRequest, type IPCResponse } from "./ipc";

export type ProcessConfig = {
  scriptPath: string;
  modelPath: string;
  device?: string;
  computeType?: string;
  voice?: string;
  env?: Record<string, string>;
};

export type ProcessHealth = {
  isHealthy: boolean;
  lastPing: number | null;
  requestCount: number;
  errorCount: number;
  uptime: number;
};

export class ModelProcess {
  private process: Subprocess | null = null;
  public readonly ipc: IPCBridge;
  private readonly config: ProcessConfig;
  private startTime = 0;
  private requestCount = 0;
  private errorCount = 0;
  private lastPing: number | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  constructor(config: ProcessConfig) {
    this.config = config;
    this.ipc = new IPCBridge({ requestTimeout: 10_000 });
  }

  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    // Resolve Python executable with UV/virtual environment support
    const { cmd, cwd } = await this.resolvePythonExecutable();

    // #region agent log
    const logData1 = {
      location: "base.ts:45",
      message: "Python command resolved",
      data: { cmd, cwd, scriptPath: this.config.scriptPath },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    };
    fetch("http://127.0.0.1:7242/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData1),
    }).catch(() => {});
    // #endregion

    // Verify dependencies before starting
    await this.verifyDependencies(cmd);

    const env: Record<string, string> = {
      ...process.env,
      WHISPER_MODEL_PATH: this.config.modelPath,
      WHISPER_DEVICE:
        this.config.device ?? (process.platform === "darwin" ? "mps" : "rocm"),
      WHISPER_COMPUTE_TYPE: this.config.computeType ?? "int8",
      PIPER_MODEL_PATH: this.config.modelPath,
      PIPER_VOICE: this.config.voice ?? "en_US-lessac-medium",
      ...this.config.env,
    };

    // #region agent log
    const logData2 = {
      location: "base.ts:59",
      message: "Environment before spawn",
      data: {
        pythonPath: env.PYTHONPATH,
        path: env.PATH?.substring(0, 100),
        piperModelPath: env.PIPER_MODEL_PATH,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    };
    fetch("http://127.0.0.1:7242/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData2),
    }).catch(() => {});
    // #endregion

    this.process = spawn({
      cmd,
      cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env,
    });

    this.startTime = Date.now();
    this.setupEventHandlers();
    this.startHealthCheck();

    // Wait for ready signal
    await this.waitForReady();
  }

  /**
   * Resolve Python executable with multi-tier fallback:
   * 1. UV run (if available and enabled)
   * 2. Virtual environment Python (if .venv exists)
   * 3. System Python (fallback)
   */
  protected async resolvePythonExecutable(): Promise<{
    cmd: string[];
    cwd: string;
  }> {
    const voiceDir = join(process.cwd(), "packages/voice");
    const scriptPath = this.config.scriptPath;

    // Get relative path from voiceDir for uv run
    const scriptRelPath = scriptPath.startsWith(voiceDir)
      ? scriptPath.slice(voiceDir.length + 1)
      : scriptPath;

    // Check if UV should be used
    const useUv = process.env.VOICE_USE_UV !== "false";
    const uvPath = useUv ? await this.findUvPath() : null;

    if (useUv && uvPath) {
      // Use uv run - automatically manages virtual environment
      // uv run uses the project directory (where pyproject.toml is)
      return {
        cmd: [uvPath, "run", "python", scriptRelPath],
        cwd: voiceDir,
      };
    }

    const pythonOverride = process.env.PYTHON_PATH;
    if (pythonOverride) {
      return {
        cmd: [pythonOverride, scriptPath],
        cwd: process.cwd(),
      };
    }

    // Check for virtual environment
    const venvPython = this.findVenvPython(voiceDir);
    if (venvPython) {
      return {
        cmd: [venvPython, scriptPath],
        cwd: process.cwd(),
      };
    }

    // Fallback to system Python
    const pythonPath = "python3";
    return {
      cmd: [pythonPath, scriptPath],
      cwd: process.cwd(),
    };
  }

  /**
   * Find UV executable in PATH
   */
  protected async findUvPath(): Promise<string | null> {
    const pathEnv = process.env.PATH ?? "";
    if (!pathEnv) {
      return null;
    }

    const entries = pathEnv.split(pathDelimiter).filter(Boolean);
    const candidates =
      process.platform === "win32"
        ? ["uv.exe", "uv.cmd", "uv.bat", "uv"]
        : ["uv"];

    for (const dir of entries) {
      for (const name of candidates) {
        const candidate = join(dir, name);
        try {
          accessSync(candidate, fsConstants.F_OK);
          const stats = statSync(candidate);
          if (!stats.isFile()) {
            continue;
          }
          if (process.platform !== "win32") {
            accessSync(candidate, fsConstants.X_OK);
          }
          return candidate;
        } catch {}
      }
    }

    return null;
  }

  /**
   * Find Python executable in virtual environment
   */
  protected findVenvPython(voiceDir: string): string | null {
    const venvPython =
      process.platform === "win32"
        ? join(voiceDir, ".venv", "Scripts", "python.exe")
        : join(voiceDir, ".venv", "bin", "python");

    try {
      accessSync(venvPython, fsConstants.F_OK);
      const stats = statSync(venvPython);
      if (!stats.isFile()) {
        return null;
      }
      return venvPython;
    } catch {
      return null;
    }
  }

  /**
   * Verify Python dependencies are installed
   * Skip verification if using uv run (uv handles dependency checking)
   */
  protected async verifyDependencies(cmd: string[]): Promise<void> {
    // Skip verification if using uv run (uv handles dependency checking)
    if (cmd[0]?.endsWith("uv") && cmd[1] === "run") {
      return;
    }

    // Extract Python executable (first element) for verification
    // cmd may be [python, scriptPath] but we only need python for verification
    const pythonExecutable = cmd[0];
    if (!pythonExecutable) {
      return; // Skip if no executable found
    }

    try {
      const proc = Bun.spawn(
        [
          pythonExecutable,
          "-c",
          `
import sys
try:
    import nemo.collections.asr
    import silero_vad
    import numpy
    import transformers
    import snac
    import soundfile
    sys.exit(0)
except ImportError as e:
    print(f"Missing dependency: {e}", file=sys.stderr)
    sys.exit(1)
      `,
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
        }
      );

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(
          "Python dependencies not installed.\n" +
            "Install with: cd packages/voice && ./scripts/install-deps.sh\n" +
            "Or use: cd packages/voice && uv sync\n" +
            `Error: ${stderr.trim()}`
        );
      }
    } catch (error) {
      // If verification fails due to command execution error, log but don't fail
      // (dependencies might still be available, just verification failed)
      if (
        error instanceof Error &&
        error.message.includes("Python dependencies not installed")
      ) {
        throw error;
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.process) {
      return;
    }

    let buffer = "";

    // Bun's Subprocess.stdout is a ReadableStream, not EventEmitter
    if (this.process.stdout && typeof this.process.stdout !== "number") {
      const reader = this.process.stdout.getReader();
      const decoder = new TextDecoder();

      // Read stream asynchronously
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
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
                const response = JSON.parse(line) as IPCResponse;
                this.ipc.handleResponse(response);
              } catch (_error) {}
            }
          }
        } catch (_error) {}
      })();
    }

    // Handle stderr
    if (this.process.stderr && typeof this.process.stderr !== "number") {
      const reader = this.process.stderr.getReader();
      const decoder = new TextDecoder();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            // Consume stream but ignore content
            decoder.decode(value);
          }
        } catch {
          // Ignore stderr read errors
        }
      })();
    }

    // Handle exit via exited promise
    this.process.exited.then((_code) => {
      this.process = null;
      this.ipc.cancelAll();
      if (!this.isShuttingDown) {
        // Auto-restart on unexpected exit
        setTimeout(() => {
          this.start().catch((_error) => {});
        }, 1000);
      }
    });
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Process failed to become ready"));
      }, 300_000); // 5 minutes for model download/load

      const checkReady = (response: IPCResponse) => {
        if (
          response.type === "status" &&
          (response.payload as { message?: string })?.message ===
            "STT server ready"
        ) {
          clearTimeout(timeout);
          resolve();
        } else if (
          response.type === "status" &&
          (response.payload as { message?: string })?.message ===
            "TTS server ready"
        ) {
          clearTimeout(timeout);
          resolve();
        } else if (response.type === "error") {
          clearTimeout(timeout);
          reject(
            new Error(
              (response.payload as { message?: string })?.message ??
                "Process initialization failed"
            )
          );
        }
      };

      // Listen for ready signal
      const originalHandle = this.ipc.handleResponse.bind(this.ipc);
      this.ipc.handleResponse = (response: IPCResponse) => {
        checkReady(response);
        originalHandle(response);
      };
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.ping();
        this.lastPing = Date.now();
      } catch (_error) {}
    }, 30_000); // Every 30 seconds
  }

  async ping(): Promise<void> {
    const request = this.ipc.createRequest("ping");
    if (!this.process) {
      throw new Error("Process not started");
    }
    await this.ipc.sendRequest(this.process, request, 2000);
  }

  async sendRequest(
    request: IPCRequest,
    timeoutMs?: number,
    onPartial?: (response: IPCResponse) => void
  ): Promise<IPCResponse> {
    if (!this.process) {
      throw new Error("Process not started");
    }

    this.requestCount++;
    try {
      return await this.ipc.sendRequest(
        this.process,
        request,
        timeoutMs,
        onPartial
      );
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  getHealth(): ProcessHealth {
    const uptime = this.startTime > 0 ? Date.now() - this.startTime : 0;
    return {
      isHealthy:
        this.process !== null &&
        ((this.lastPing !== null && Date.now() - this.lastPing < 60_000) ||
          uptime < 60_000), // Consider healthy if just started (< 60s) even if no ping yet
      lastPing: this.lastPing,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      uptime,
    };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.process) {
      try {
        const request = this.ipc.createRequest("shutdown");
        await this.ipc.sendRequest(this.process, request, 2000);
      } catch {
        // Ignore shutdown errors
      }

      // In Bun, process.kill() is a method, but sometimes this.process might be null
      // or the type definition might be slightly off in edge cases.
      // However, the error "TypeError: null is not an object (evaluating 'this.process.kill')"
      // implies this.process became null.
      // We checked if (this.process) above, but awaiting sendRequest allows microtask interleaving
      // where it might have been cleared by the exit handler.
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
    }

    this.ipc.cancelAll();
  }
}

/**
 * Internal methods exposed for testing.
 * Allows testing resolution logic without spawning actual processes.
 */
export const __internals = {
  resolvePythonExecutable: (instance: ModelProcess) =>
    (
      instance as unknown as {
        resolvePythonExecutable: () => Promise<{ cmd: string[]; cwd: string }>;
      }
    ).resolvePythonExecutable.bind(instance),
  findUvPath: (instance: ModelProcess) =>
    (
      instance as unknown as { findUvPath: () => Promise<string | null> }
    ).findUvPath.bind(instance),
  findVenvPython: (instance: ModelProcess) =>
    (
      instance as unknown as {
        findVenvPython: (voiceDir: string) => string | null;
      }
    ).findVenvPython.bind(instance),
  verifyDependencies: (instance: ModelProcess) =>
    (
      instance as unknown as {
        verifyDependencies: (cmd: string[]) => Promise<void>;
      }
    ).verifyDependencies.bind(instance),
};
