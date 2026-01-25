#!/usr/bin/env bun

import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

function usage(): string {
  return [
    "Usage:",
    "  bun scripts/harbor-fixture-sig.ts [--root <dir>]",
    "",
    "This script recomputes `tests.sig` files for Harbor fixtures under:",
    "  harbor/fixtures/<taskId>/workspace/",
    "",
    "It hashes all files under `test/` (if present), sorted by relative path,",
    "and writes a stable signature file at `tests.sig` in the workspace root.",
  ].join("\n");
}

async function listFilesRec(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRec(p)));
      continue;
    }
    if (entry.isFile()) {
      out.push(p);
    }
  }
  return out;
}

async function sha256File(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

async function writeSig(
  workspaceDir: string
): Promise<{ ok: boolean; reason?: string }> {
  const testDir = path.join(workspaceDir, "test");
  const exists = await fs
    .stat(testDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!exists) {
    return { ok: false, reason: "no_test_dir" };
  }

  const files = (await listFilesRec(testDir))
    .map((p) => path.relative(workspaceDir, p))
    .sort((a, b) => a.localeCompare(b));

  const lines: string[] = [];
  for (const rel of files) {
    const abs = path.join(workspaceDir, rel);
    const hash = await sha256File(abs);
    lines.push(`${hash}  ${rel}`);
  }

  await fs.writeFile(
    path.join(workspaceDir, "tests.sig"),
    `${lines.join("\n")}\n`,
    "utf8"
  );
  return { ok: true };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }

  let root = path.resolve("harbor", "fixtures");
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--root" && args[i + 1]) {
      root = path.resolve(args[i + 1]);
      i += 1;
    }
  }

  const fixtures = await fs.readdir(root, { withFileTypes: true });
  const results: { fixture: string; ok: boolean; reason?: string }[] = [];
  for (const entry of fixtures) {
    if (!entry.isDirectory()) {
      continue;
    }
    const fixture = entry.name;
    const workspaceDir = path.join(root, fixture, "workspace");
    const wsOk = await fs
      .stat(workspaceDir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (!wsOk) {
      continue;
    }
    const r = await writeSig(workspaceDir);
    results.push({ fixture, ...r });
  }

  process.stdout.write(`${JSON.stringify({ root, results }, null, 2)}\n`);
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(
      `harbor_fixture_sig_failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
