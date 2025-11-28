import {
  accessSync,
  chmodSync,
  constants as fsConstants,
  mkdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Subprocess } from "bun";
import { ensureFdInheritable } from "./fd.js";
import type { DirectoryHandle } from "./filesystem.js";

const WRAPPER_ENV_OVERRIDE = "ORCH_SECURE_SPAWN_WRAPPER";
const FD_ENV = "ALFRED_CWD_FD";
const CC_ENV = "ORCH_SECURE_SPAWN_CC";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, "..", "..");
const SOURCE_PATH = path.join(PACKAGE_ROOT, "native", "securespawn.c");
const BIN_DIR = path.join(PACKAGE_ROOT, "bin");

const textDecoder = new TextDecoder();

type SpawnStreamOption =
  | "pipe"
  | "inherit"
  | "ignore"
  | null
  | number
  | ReadableStream;

export type SecureSpawnOptions = {
  cwdHandle: DirectoryHandle;
  cmd: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  stdin?: SpawnStreamOption;
  stdout?: SpawnStreamOption;
  stderr?: SpawnStreamOption;
};

export function spawnWithSecureCwd(options: SecureSpawnOptions): Subprocess {
  const { cwdHandle, cmd, args = [], env, stdin, stdout, stderr } = options;

  ensureFdInheritable(cwdHandle.fd);
  const wrapperPath = resolveSecureSpawnWrapper();

  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      childEnv[key] = value;
    }
  }
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") {
        childEnv[key] = value;
      } else {
        delete childEnv[key];
      }
    }
  }
  childEnv[FD_ENV] = String(cwdHandle.fd);
  delete childEnv[WRAPPER_ENV_OVERRIDE];

  const command = [wrapperPath, cmd, ...args];

  return Bun.spawn(command, {
    env: childEnv,
    stdin: (stdin ?? "inherit") as
      | "inherit"
      | "pipe"
      | "ignore"
      | null
      | number
      | ReadableStream,
    stdout: (stdout ?? "pipe") as
      | "inherit"
      | "pipe"
      | "ignore"
      | null
      | number,
    stderr: (stderr ?? "pipe") as
      | "inherit"
      | "pipe"
      | "ignore"
      | null
      | number,
  });
}

function resolveSecureSpawnWrapper(): string {
  const override = process.env[WRAPPER_ENV_OVERRIDE]?.trim();
  if (override) {
    accessSync(override, fsConstants.X_OK);
    return override;
  }

  if (process.platform === "win32") {
    throw new Error(
      "secure fd cwd spawning requires a POSIX host; set ORCH_SECURE_SPAWN_WRAPPER to a compatible wrapper"
    );
  }

  mkdirSync(BIN_DIR, { recursive: true });
  const target = path.join(
    BIN_DIR,
    `securespawn-${process.platform}-${process.arch}`
  );

  if (needsRebuild(target)) {
    compileWrapper(target);
  }

  accessSync(target, fsConstants.X_OK);
  return target;
}

function needsRebuild(target: string): boolean {
  try {
    const targetStats = statSync(target);
    const sourceStats = statSync(SOURCE_PATH);
    return sourceStats.mtimeMs > targetStats.mtimeMs;
  } catch {
    return true;
  }
}

function compileWrapper(target: string) {
  const compilers = getCompilerCandidates();
  const errors: string[] = [];

  for (const compiler of compilers) {
    const result = Bun.spawnSync(
      [
        compiler,
        SOURCE_PATH,
        "-std=c17",
        "-O2",
        "-Wall",
        "-Wextra",
        "-pedantic",
        "-DNDEBUG",
        "-o",
        target,
      ],
      {
        stderr: "pipe",
        stdout: "pipe",
      }
    );

    if (result.success) {
      try {
        chmodSync(target, 0o755);
      } catch {
        // ignore – compiler usually sets mode
      }
      return;
    }

    const stderrText =
      result.stderr && result.stderr.length > 0
        ? textDecoder.decode(result.stderr)
        : `exit code ${result.exitCode}`;
    errors.push(`[${compiler}] ${stderrText.trim()}`);
  }

  throw new Error(
    `failed to compile secure spawn wrapper via ${compilers.join(", ")} :: ${errors.join(
      " | "
    )}`
  );
}

function getCompilerCandidates(): string[] {
  const override = process.env[CC_ENV]?.trim();
  if (override) {
    return override
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return ["cc", "clang", "gcc"];
}
