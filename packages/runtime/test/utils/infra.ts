import path from "node:path";

export interface CmdResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

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

export function toPosixPath(p: string): string {
  return p.split(path.sep).join(path.posix.sep);
}
