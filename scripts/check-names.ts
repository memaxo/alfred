#!/usr/bin/env bun

/**
 * ALFRED Naming Convention Checker
 * Enforces single-word naming rules across the codebase
 *
 * Rules:
 * - Files: avoid `-` and `_` in basenames (framework exceptions allowed)
 * - Identifiers: avoid `_` in param names (underscore prefix allowed)
 * - No adjectives: avoid "enhanced", "improved", "better", "optimized", etc.
 */

import { basename, extname } from "node:path";

type Violation = {
  file: string;
  line: number;
  type: "file" | "class" | "param" | "adjective";
  message: string;
};

const FORBIDDEN_ADJECTIVES = [
  "enhanced",
  "improved",
  "better",
  "optimized",
  "advanced",
  "smart",
  "faster",
  "quick",
  "robust",
  "stable",
] as const;

const adjectiveRe = new RegExp(
  `\\b(${FORBIDDEN_ADJECTIVES.join("|")})\\b`,
  "i"
);

function isTextFile(path: string): boolean {
  return (
    path.endsWith(".ts") ||
    path.endsWith(".tsx") ||
    path.endsWith(".js") ||
    path.endsWith(".jsx")
  );
}

function stripKnownSuffixes(stem: string): string {
  const suffixes = [".test", ".spec", ".types", ".hot"] as const;
  for (const s of suffixes) {
    if (stem.endsWith(s)) {
      return stem.slice(0, -s.length);
    }
  }
  return stem;
}

function baseStem(file: string): string {
  const name = basename(file);
  if (name.endsWith(".d.ts")) {
    return stripKnownSuffixes(name.slice(0, -".d.ts".length));
  }
  const ext = extname(name);
  return stripKnownSuffixes(ext ? name.slice(0, -ext.length) : name);
}

function allowFrameworkFileStem(stem: string): boolean {
  // TanStack Start / routing and framework-mandated files.
  if (stem === "_layout" || stem === "+not-found") {
    return true;
  }
  if (stem.startsWith("+") || stem.startsWith("_")) {
    return true;
  }
  if (stem.includes("$")) {
    return true;
  }
  return false;
}

function addViolation(
  violations: Violation[],
  v: Omit<Violation, "line"> & { line?: number }
): void {
  violations.push({ ...v, line: v.line ?? 1 });
}

function checkNames(): Violation[] {
  const violations: Violation[] = [];

  const glob = new Bun.Glob(
    "{apps,packages,scripts,tests}/**/*.{ts,tsx,js,jsx}"
  );
  for (const file of glob.scanSync({ dot: false })) {
    if (
      file.includes("/vendor/") ||
      file.includes("/node_modules/") ||
      file.includes("/.turbo/") ||
      file.includes("/.source/")
    ) {
      continue;
    }

    const stem = baseStem(file);
    if (
      !allowFrameworkFileStem(stem) &&
      (stem.includes("-") || stem.includes("_"))
    ) {
      addViolation(violations, {
        file,
        type: "file",
        message: `Disallowed filename characters in "${stem}" (avoid '-' and '_')`,
      });
    }

    if (!isTextFile(file)) {
      continue;
    }

    const text = Bun.file(file).text();
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }

      // Adjectives (anywhere in code/comments).
      if (adjectiveRe.test(line)) {
        addViolation(violations, {
          file,
          line: i + 1,
          type: "adjective",
          message: "Forbidden adjective found",
        });
      }

      // Param names: flag underscores (except leading `_` for intentionally-unused).
      // This is a heuristic (not full AST parsing) but catches most cases cheaply.
      const paramMatches = line.matchAll(/\(\s*([^)]*)\)/g);
      for (const match of paramMatches) {
        const params = match[1];
        if (!params) {
          continue;
        }
        for (const rawParam of params.split(",")) {
          const p = rawParam.trim().split(/[:=]/)[0]?.trim();
          if (!p) {
            continue;
          }
          if (p.startsWith("...")) {
            continue;
          }
          if (p.startsWith("_")) {
            continue;
          }
          if (p.includes("_")) {
            addViolation(violations, {
              file,
              line: i + 1,
              type: "param",
              message: `Disallowed '_' in param name "${p}"`,
            });
          }
        }
      }

      // Class/interface names: forbid adjective terms in identifiers.
      const decl = line.match(/\b(class|interface)\s+([A-Za-z0-9_]+)/);
      const name = decl?.[2];
      if (name && adjectiveRe.test(name)) {
        addViolation(violations, {
          file,
          line: i + 1,
          type: "class",
          message: `Forbidden adjective in ${decl?.[1] ?? "type"} name "${name}"`,
        });
      }
    }
  }

  return violations;
}

function main() {
  console.log("ALFRED Naming Convention Checker");

  const violations = checkNames();

  if (violations.length > 0) {
    console.error(`Found ${violations.length} naming violations:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} [${v.type}] ${v.message}`);
    }
    process.exit(1);
  }

  console.log("All naming conventions passed!");
}

if (import.meta.main) {
  main();
}
