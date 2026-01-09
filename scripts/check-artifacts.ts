#!/usr/bin/env bun

import { unlink } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

const ALLOWLIST = new Set([
  "packages/auth/src/better-auth-tanstack-start.d.ts",
  "packages/cortex/src/wgsl.d.ts",
  "packages/agent/src/bun-bundle.d.ts",
]);

const FORBIDDEN_GLOBS = [
  "packages/*/src/**/*.js",
  "packages/*/src/**/*.js.map",
  "packages/*/src/**/*.d.ts",
  "packages/*/src/**/*.d.ts.map",
  "packages/*/*/src/**/*.js",
  "packages/*/*/src/**/*.js.map",
  "packages/*/*/src/**/*.d.ts",
  "packages/*/*/src/**/*.d.ts.map",
] as const;

function normalizePath(rel: string): string {
  return rel.replace(/\\/g, "/");
}

export async function findForbiddenArtifacts(): Promise<string[]> {
  const hits = new Set<string>();

  for (const pattern of FORBIDDEN_GLOBS) {
    const glob = new Bun.Glob(pattern);
    for await (const match of glob.scan({ cwd: ROOT })) {
      const normalized = normalizePath(match);

      // dist/ is an allowed build output location; its internal layout may include a src/
      // segment depending on the package build tool.
      if (normalized.includes("/dist/")) {
        continue;
      }
      if (ALLOWLIST.has(normalized)) {
        continue;
      }
      hits.add(normalized);
    }
  }

  return Array.from(hits).sort((a, b) => a.localeCompare(b));
}

async function main(): Promise<void> {
  const fixMode = process.argv.includes("--fix");
  const hits = await findForbiddenArtifacts();
  if (hits.length === 0) {
    console.log(
      "[check-artifacts] OK (no generated artifacts under packages/*/src)"
    );
    return;
  }

  if (fixMode) {
    const results = await Promise.all(
      hits.map(async (hit) => {
        const abs = resolve(ROOT, hit);
        try {
          await unlink(abs);
          return true;
        } catch {
          // best-effort: ignore missing or permission errors
          return false;
        }
      })
    );
    const deleted = results.filter(Boolean).length;

    const remaining = await findForbiddenArtifacts();
    if (remaining.length > 0) {
      console.error(
        `[check-artifacts] Deleted ${deleted} file(s), but ${remaining.length} forbidden file(s) remain.`
      );
      for (const hit of remaining) {
        console.error(`- ${hit}`);
      }
      process.exit(1);
    }

    console.log(
      `[check-artifacts] Deleted ${deleted} generated artifact(s) under packages/*/src`
    );
    return;
  }

  console.error(
    "[check-artifacts] Forbidden generated artifacts detected under packages/*/src.\n" +
      "Delete them and ensure no tool regenerates them.\n"
  );

  for (const hit of hits) {
    console.error(`- ${hit}`);
  }

  process.exit(1);
}

if (import.meta.main) {
  await main();
}
