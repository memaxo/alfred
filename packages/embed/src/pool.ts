/**
 * Embedding Pool Management
 * Manages pool of embedding worker processes with load balancing
 */

import { join } from "node:path";
import { EmbedProcess } from "./process";
import type { EmbedConfig } from "./types";

export class EmbedPool {
  private processes: EmbedProcess[] = [];
  private readonly poolSize: number;
  private currentIndex = 0;
  private readonly config: EmbedConfig;
  private isInitialized = false;

  constructor(config: EmbedConfig = {}) {
    this.config = config;
    const isDev = process.env.NODE_ENV !== "production";
    this.poolSize = config.poolSize ?? (isDev ? 1 : 2);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    await this.ensureDependencies();
    await this.ensureModelDownloaded();

    for (let i = 0; i < this.poolSize; i++) {
      const proc = new EmbedProcess(this.config);
      await proc.start();
      this.processes.push(proc);
    }

    this.isInitialized = true;
  }

  private async ensureDependencies(): Promise<void> {
    const embedDir = join(import.meta.dir, "..");
    const venvPath = join(embedDir, ".venv");
    const uvLockPath = join(embedDir, "uv.lock");

    // Check if UV is available
    let hasUV = false;
    try {
      const uvCheck = Bun.spawnSync(["which", "uv"]);
      hasUV = uvCheck.exitCode === 0;
    } catch {
      hasUV = false;
    }

    if (!hasUV) {
      return;
    }

    // Check if venv exists and has required packages
    const venvExists = await Bun.file(join(venvPath, "pyvenv.cfg")).exists();
    const lockExists = await Bun.file(uvLockPath).exists();

    if (venvExists && lockExists) {
      return;
    }

    const syncProc = Bun.spawn(["uv", "sync"], {
      cwd: embedDir,
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await syncProc.exited;
    if (exitCode !== 0) {
      throw new Error(`uv sync failed with exit code ${exitCode}`);
    }
  }

  private async ensureModelDownloaded(): Promise<void> {
    const modelName =
      this.config.modelName ?? "tencent/KaLM-Embedding-Gemma3-12B-2511";
    const modelsDir = join(import.meta.dir, "../models");
    const modelPath = join(modelsDir, modelName);

    // Check if model exists
    const configFile = Bun.file(join(modelPath, "config.json"));
    if (await configFile.exists()) {
      return;
    }

    const downloadScript = join(
      import.meta.dir,
      "../scripts/download_model.py"
    );

    // Use UV if available, otherwise system Python
    let pythonCmd = "python3";
    try {
      const uvCheck = Bun.spawnSync(["which", "uv"]);
      if (uvCheck.exitCode === 0) {
        pythonCmd = "uv";
      }
    } catch {
      // UV not available
    }

    const cmd =
      pythonCmd === "uv"
        ? ["uv", "run", "python", downloadScript]
        : [pythonCmd, downloadScript];

    const proc = Bun.spawn(cmd, {
      cwd: join(import.meta.dir, ".."),
      stdout: "inherit",
      stderr: "inherit",
      stdin: "pipe",
    });

    // Auto-answer "y" if prompted
    if (proc.stdin && typeof proc.stdin !== "number") {
      proc.stdin.write("y\n");
      proc.stdin.end();
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Model download failed with exit code ${exitCode}`);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new Error("Pool not initialized - call initialize() first");
    }

    if (texts.length === 0) {
      return [];
    }

    // Round-robin load balancing
    const proc = this.processes[this.currentIndex];
    if (!proc) {
      throw new Error("No workers available");
    }

    this.currentIndex = (this.currentIndex + 1) % this.poolSize;

    return await proc.sendRequest(texts);
  }

  getHealth(): {
    index: number;
    pid?: number;
    status: "idle" | "busy" | "error" | "terminated";
    lastActive: number;
    uptime: number;
  }[] {
    return this.processes.map((proc, index) => ({
      index,
      ...proc.getHealth(),
    }));
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.processes.map((proc) => proc.shutdown()));

    this.processes = [];
    this.isInitialized = false;
  }
}
