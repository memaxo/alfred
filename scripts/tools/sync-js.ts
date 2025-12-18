#!/usr/bin/env bun
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "sucrase";

const ROOT = process.cwd();
const CHECK_MODE = process.argv.includes("--check");
const IGNORE_PREFIXES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".turbo/",
  "coverage/",
  "tmp/",
  "temp/",
];
const IGNORE_SEGMENTS = [
  "/node_modules/",
  "/dist/",
  "/build/",
  "/.turbo/",
  "/.next/",
  "/.svelte-kit/",
  "/.output/",
  "/.vercel/",
  "/coverage/",
  "/tmp/",
  "/temp/",
];

async function fileExists(target: string): Promise<boolean> {
  try {
    const stats = await stat(target);
    return stats.isFile();
  } catch {
    return false;
  }
}

function shouldIgnore(relPath: string): boolean {
  if (relPath.startsWith(".")) {
    const withoutDot = relPath.slice(1);
    if (withoutDot.startsWith("/")) {
      return shouldIgnore(withoutDot.slice(1));
    }
  }

  for (const prefix of IGNORE_PREFIXES) {
    if (relPath.startsWith(prefix)) {
      return true;
    }
  }

  for (const segment of IGNORE_SEGMENTS) {
    if (relPath.includes(segment)) {
      return true;
    }
  }

  return false;
}

function ensureTrailingNewline(code: string): string {
  return code.endsWith("\n") ? code : `${code}\n`;
}

async function main() {
  const glob = new Bun.Glob("**/*.js");
  const targets: Array<{ jsRel: string; tsRel: string }> = [];

  for await (const match of glob.scan({ cwd: ROOT })) {
    const normalized = match.replace(/\\/g, "/");
    if (shouldIgnore(normalized)) {
      continue;
    }

    if (!normalized.endsWith(".js")) {
      continue;
    }

    const base = normalized.slice(0, -3);
    const tsCandidate = `${base}.ts`;
    const tsxCandidate = `${base}.tsx`;

    let sourceRel: string | null = null;
    if (await fileExists(path.join(ROOT, tsCandidate))) {
      sourceRel = tsCandidate;
    } else if (await fileExists(path.join(ROOT, tsxCandidate))) {
      sourceRel = tsxCandidate;
    }

    if (!sourceRel) {
      continue;
    }

    targets.push({ jsRel: normalized, tsRel: sourceRel });
  }

  targets.sort((a, b) => a.jsRel.localeCompare(b.jsRel));

  let updated = 0;
  let stale = 0;

  for (const target of targets) {
    const tsPath = path.join(ROOT, target.tsRel);
    const jsPath = path.join(ROOT, target.jsRel);
    const source = await readFile(tsPath, "utf8");
    const transforms = target.tsRel.endsWith(".tsx")
      ? ["typescript", "jsx"]
      : ["typescript"];

    const output = ensureTrailingNewline(
      transform(source, {
        transforms,
        filePath: target.tsRel,
        production: true,
      }).code
    );

    let existing = "";
    try {
      existing = await readFile(jsPath, "utf8");
    } catch {
      // File might not exist yet; treat as stale.
    }

    if (existing === output) {
      continue;
    }

    if (CHECK_MODE) {
      stale += 1;
      continue;
    }

    await writeFile(jsPath, output, "utf8");
    updated += 1;
  }

  if (CHECK_MODE) {
    if (stale > 0) {
      console.error(
        `[tools:sync-js] ${stale} file(s) are out of date. Run "bun run tools:sync-js" and commit the updated artifacts.`
      );
      process.exit(1);
    }
    console.log("[tools:sync-js] All tracked .js artifacts are up to date.");
    return;
  }

  console.log(
    `[tools:sync-js] Updated ${updated} file(s); checked ${targets.length} potential artifacts.`
  );
}

await main();
