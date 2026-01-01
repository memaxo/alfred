#!/usr/bin/env bun

import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");

const tag = process.argv[2]?.trim() || "alfred-agentfs:codex";
const dockerfile = path.join(ROOT, "docker", "agentfs", "Dockerfile");

async function main(): Promise<void> {
  const proc = Bun.spawn(
    ["docker", "build", "-f", dockerfile, "-t", tag, ROOT],
    {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "ignore",
    }
  );

  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`agentfs_image_build_failed:${code}`);
  }
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[agentfs:image] ${msg}`);
  process.exit(1);
});
