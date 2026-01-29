#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function hasTsSibling(absJs: string): boolean {
  if (!absJs.endsWith(".js")) {
    return false;
  }

  const base = absJs.slice(0, -3);
  return existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
}

function scan(pattern: string): string[] {
  const glob = new Bun.Glob(pattern);
  const out: string[] = [];
  for (const rel of glob.scanSync({ cwd: ROOT })) {
    const abs = resolve(ROOT, rel);
    if (hasTsSibling(abs)) {
      out.push(rel);
    }
  }
  return out;
}

const artifacts = [
  ...scan("packages/*/src/**/*.js"),
  ...scan("apps/*/src/**/*.js"),
].sort();

if (artifacts.length > 0) {
  process.stderr.write("forbidden_src_js_artifacts:\n");
  for (const rel of artifacts) {
    process.stderr.write(`- ${rel}\n`);
  }
  process.stderr.write(
    "\nThese .js files shadow TypeScript sources at runtime (Bun/Node will prefer .js when it exists).\n" +
      "Remove them and fix whatever is emitting them (tsc without outDir, editor plugin, etc).\n" +
      "Cleanup:\n" +
      "  python3 scripts/cleanup-src-js.py\n"
  );
  process.exit(1);
}
