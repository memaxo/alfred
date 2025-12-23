/**
 * Codex process spawner
 *
 * Handles spawn function creation for different execution modes:
 * - Docker container execution
 * - Poof sandbox execution (feature-flagged)
 * - Direct host execution
 */

import os from "node:os";
import path from "node:path";
import { feature } from "bun:bundle";
import type { SpawnFn } from "@alfred/codex";
import { spawnWithSecureCwd } from "../../../security/secure-spawn.js";
import { resolveExecutable } from "./policy.js";
import { CodexError } from "./error.js";

type AllowedDirectoryHandle = {
  path: string;
  fd: number;
  close: () => void;
};

type SpawnInput = {
  containerId?: string;
  containerCw?: string;
  poofUpperDir?: string;
  poofProfile?: "minimal" | "standard" | "intensive";
  poofMode?: "exec" | "run";
};

type SpawnResult = {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill: (signal?: number | string) => void;
};

function isWithinDir(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === "" || !(rel.startsWith("..") || path.isAbsolute(rel));
}

function wrapProcess(
  proc: ReturnType<typeof spawnWithSecureCwd>
): SpawnResult {
  return {
    stdout:
      typeof proc.stdout === "number" ? null : (proc.stdout ?? null),
    stderr:
      typeof proc.stderr === "number" ? null : (proc.stderr ?? null),
    exited: proc.exited,
    kill: (signal) => {
      if (typeof signal === "number") {
        proc.kill(signal);
        return;
      }
      if (typeof signal === "string") {
        proc.kill(signal as NodeJS.Signals);
        return;
      }
      proc.kill();
    },
  };
}

function createDockerSpawn(
  cwdHandle: AllowedDirectoryHandle,
  dockerBin: string,
  containerId: string,
  containerCw?: string
): SpawnFn {
  return ({ cmd: _cmd, args, env: childEnv }) => {
    const containerWorkdir = containerCw?.trim();
    if (containerWorkdir && !containerWorkdir.startsWith("/workspace")) {
      throw new CodexError(
        "spawn",
        "codex_container_cwd_invalid",
        "containerCw must be under /workspace"
      );
    }
    const dockerWorkdir =
      containerWorkdir && containerWorkdir.length > 0
        ? containerWorkdir
        : "/workspace";

    const envKeys = Object.keys(childEnv ?? {}).filter((k) => k !== "PATH");
    const dockerArgs = [
      "exec",
      "--workdir",
      dockerWorkdir,
      ...envKeys.flatMap((k) => ["-e", k]),
      containerId,
      "codex",
      ...args,
    ];

    const proc = spawnWithSecureCwd({
      cwdHandle,
      cmd: dockerBin,
      args: dockerArgs,
      env: childEnv,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    return wrapProcess(proc);
  };
}

async function createPoofSpawn(
  cwdHandle: AllowedDirectoryHandle,
  poofUpperDir: string,
  poofProfile: "minimal" | "standard" | "intensive",
  poofMode: "exec" | "run"
): Promise<SpawnFn> {
  const poofModule = await import("../../../spawn/poof.js");
  const poofBin = poofModule.getPoofBinary();
  const profile =
    poofProfile in poofModule.POOF_PROFILES
      ? poofModule.POOF_PROFILES[
          poofProfile as keyof typeof poofModule.POOF_PROFILES
        ]
      : poofModule.POOF_PROFILES.standard;

  const poofUpperResolved = path.resolve(poofUpperDir);
  const tmpBase = path.resolve(os.tmpdir());
  if (!isWithinDir(tmpBase, poofUpperResolved)) {
    throw new CodexError(
      "spawn",
      "poof_upper_dir_invalid",
      "poofUpperDir must be under tmpdir"
    );
  }

  return ({ cmd, args, env: childEnv }) => {
    const poofArgs = [
      ...poofModule.buildPoofArgs({
        mode: poofMode,
        upperDir: poofUpperResolved,
        profile,
      }),
      "--",
      cmd,
      ...args,
    ];

    const proc = spawnWithSecureCwd({
      cwdHandle,
      cmd: poofBin,
      args: poofArgs,
      env: childEnv,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    return wrapProcess(proc);
  };
}

function createHostSpawn(cwdHandle: AllowedDirectoryHandle): SpawnFn {
  return ({ cmd, args, env: childEnv }) => {
    const proc = spawnWithSecureCwd({
      cwdHandle,
      cmd,
      args,
      env: childEnv,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    return wrapProcess(proc);
  };
}

export async function createCodexSpawn(
  input: SpawnInput,
  cwdHandle: AllowedDirectoryHandle
): Promise<SpawnFn> {
  if (input.containerId) {
    const dockerBin = resolveExecutable("docker");
    return createDockerSpawn(
      cwdHandle,
      dockerBin,
      input.containerId,
      input.containerCw
    );
  }

  if (feature("LEGACY_POOF") && input.poofUpperDir?.trim()) {
    return createPoofSpawn(
      cwdHandle,
      input.poofUpperDir.trim(),
      input.poofProfile ?? "standard",
      input.poofMode ?? "run"
    );
  }

  return createHostSpawn(cwdHandle);
}
