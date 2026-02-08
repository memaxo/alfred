#!/usr/bin/env bun

import { extname } from "node:path";

const JS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function readStagedFiles(): Promise<string[]> {
  const proc = Bun.spawn(["git", "diff", "--name-only", "--cached", "-z"], {
    stdout: "pipe",
    stderr: "inherit",
    stdin: "ignore",
  });

  const output = await new Response(proc.stdout).arrayBuffer();
  const code = await proc.exited;
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const text = new TextDecoder().decode(output);
  return text.split("\0").filter(Boolean);
}

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });

  const code = await proc.exited;
  if (code !== 0) {
    process.exit(code ?? 1);
  }
}

const staged = await readStagedFiles();
const targets = staged.filter((file) => JS_EXTS.has(extname(file)));

if (targets.length === 0) {
  process.exit(0);
}

await run(["bun", "x", "oxfmt", "--write", ...targets]);
await run(["bun", "x", "oxlint", "--fix", ...targets]);
