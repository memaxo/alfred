#!/usr/bin/env bun

import { access, chmod, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const VENDORED = path.join(ROOT, "vendor", "codex");
const CACHE_DIR = path.join(ROOT, ".cache", "codex");
const TARGET_DIR = path.join(CACHE_DIR, "target");
const BIN_DIR = path.join(CACHE_DIR, "bin");
const OUT_BIN = path.join(BIN_DIR, "codex");

async function exists(dir: string): Promise<boolean> {
  try {
    await stat(dir);
    return true;
  } catch {
    return false;
  }
}

async function ensureCargo(): Promise<void> {
  const proc = Bun.spawn(["cargo", "--version"], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error("cargo_not_available");
  }
}

async function main(): Promise<void> {
  if (!(await exists(VENDORED))) {
    throw new Error(
      "codex_submodule_missing: run `git submodule update --init --recursive`"
    );
  }

  await ensureCargo();

  await mkdir(TARGET_DIR, { recursive: true });
  await mkdir(BIN_DIR, { recursive: true });

  console.log("[codex:build] building vendored codex (release)");

  const build = Bun.spawn(["cargo", "build", "--release"], {
    cwd: VENDORED,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: TARGET_DIR,
    },
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });

  const exit = await build.exited;
  if (exit !== 0) {
    throw new Error(`codex_build_failed:${exit}`);
  }

  const builtBin = path.join(TARGET_DIR, "release", "codex");
  await access(builtBin);

  await Bun.write(OUT_BIN, Bun.file(builtBin));
  await chmod(OUT_BIN, 0o755);

  console.log(`[codex:build] wrote ${path.relative(ROOT, OUT_BIN)}`);
  console.log("[codex:build] set CODEX_BIN=.cache/codex/bin/codex to use it");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[codex:build] ${message}`);
  process.exit(1);
});
