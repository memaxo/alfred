import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

export type CmdResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const decoder = new TextDecoder();

export function runCmd(argv: string[]): CmdResult {
  const proc = Bun.spawnSync(argv, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdout =
    proc.stdout && typeof proc.stdout !== "number"
      ? decoder.decode(proc.stdout)
      : "";
  const stderr =
    proc.stderr && typeof proc.stderr !== "number"
      ? decoder.decode(proc.stderr)
      : "";

  return { exitCode: proc.exitCode ?? 1, stdout, stderr };
}

export function isDockerAvailable(): boolean {
  return runCmd(["docker", "info"]).exitCode === 0;
}

export function isImageAvailable(tag: string): boolean {
  return runCmd(["docker", "image", "inspect", tag]).exitCode === 0;
}

export function dockerRun(tag: string, script: string): CmdResult {
  return runCmd([
    "docker",
    "run",
    "--rm",
    "--pull=never",
    tag,
    "sh",
    "-lc",
    script,
  ]);
}

export function createRepoTestDir(prefix: string): string {
  const base = path.join(process.cwd(), ".agent", "test-workspaces");
  mkdirSync(base, { recursive: true });
  const dir = path.join(
    base,
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanupTestDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function toPosixPath(p: string): string {
  return p.split(path.sep).join(path.posix.sep);
}
