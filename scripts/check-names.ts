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
import * as ts from "typescript";

interface Violation {
  file: string;
  line: number;
  type: "file" | "class" | "param" | "adjective";
  message: string;
}

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
  // Allow multi-word suffixes for test files (e.g., .integration.test.ts)
  if (stem.includes(".integration.test") || stem.includes(".e2e.test")) {
    const base = stem.split(".")[0];
    return base;
  }
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

  // Handle .integration.test.ts and .e2e.test.ts files - extract base name before .integration/.e2e
  if (name.includes(".integration.test.") || name.includes(".e2e.test.")) {
    const parts = name.split(".");
    const basePart = parts[0];
    return basePart;
  }

  // Handle .test.ts, .spec.ts, .types.ts, .hot.ts
  if (name.endsWith(".d.ts")) {
    return stripKnownSuffixes(name.slice(0, -".d.ts".length));
  }
  const ext = extname(name);
  const withoutExt = ext ? name.slice(0, -ext.length) : name;
  return stripKnownSuffixes(withoutExt);
}

function allowFrameworkFileStem(stem: string, file: string): boolean {
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

  // Allow React/React Native ergonomics in UI packages (per .ruler/01-naming-conventions.md)
  // Examples: use-color-scheme.ts, android-navigation-bar.tsx, header-button.tsx, sign-in.tsx
  if (
    file.includes("/packages/ui/") ||
    file.includes("/apps/web/src/") ||
    file.includes("/apps/native/")
  ) {
    // Allow common UI patterns: use-*, *-button, *-bar, sign-*, etc.
    if (
      stem.startsWith("use-") ||
      stem.endsWith("-button") ||
      stem.endsWith("-bar") ||
      stem.startsWith("sign-") ||
      stem.includes("-navigation-") ||
      stem.includes("-color-")
    ) {
      return true;
    }
  }

  // Allow generated outputs outside apps/*/src and packages/*/src
  if (
    !(
      file.match(/\/apps\/[^/]+\/src\//) ||
      file.match(/\/packages\/[^/]+\/src\//)
    )
  ) {
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

function checkExportedSymbols(
  sourceFile: ts.SourceFile,
  violations: Violation[]
): void {
  const file = sourceFile.fileName;

  function visit(node: ts.Node): void {
    // Check exported symbols
    if (
      (ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isVariableStatement(node)) &&
      node.name
    ) {
      const name = node.name.getText(sourceFile);
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.name.getStart()).line + 1;

      // Check for adjectives in class/interface names
      if (
        (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
        adjectiveRe.test(name)
      ) {
        addViolation(violations, {
          file,
          line,
          type: "class",
          message: `Forbidden adjective in ${ts.isClassDeclaration(node) ? "class" : "interface"} name "${name}"`,
        });
      }

      // Check for underscores in exported symbol names (except for private fields)
      if (
        name.includes("_") &&
        !name.startsWith("_") &&
        !ts.isVariableStatement(node)
      ) {
        addViolation(violations, {
          file,
          line,
          type: "class",
          message: `Disallowed '_' in exported symbol name "${name}"`,
        });
      }
    }

    // Check function parameters
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      node.parameters.forEach((param) => {
        if (!param.name) {
          return;
        }

        // Skip destructured parameters (handled separately)
        if (
          ts.isObjectBindingPattern(param.name) ||
          ts.isArrayBindingPattern(param.name)
        ) {
          return;
        }

        const paramName = ts.isIdentifier(param.name)
          ? param.name.text
          : param.name.getText(sourceFile);
        const line =
          sourceFile.getLineAndCharacterOfPosition(param.name.getStart()).line +
          1;

        // Allow underscore prefix for intentionally unused params
        if (paramName.startsWith("_")) {
          return;
        }

        if (paramName.includes("_")) {
          addViolation(violations, {
            file,
            line,
            type: "param",
            message: `Disallowed '_' in param name "${paramName}"`,
          });
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

async function checkNames(): Promise<Violation[]> {
  const violations: Violation[] = [];

  const glob = new Bun.Glob(
    "{apps,packages,scripts,tests}/**/*.{ts,tsx,js,jsx}"
  );
  const files = [...glob.scanSync({ dot: false })];

  // Read all files in parallel
  const fileContents = await Promise.allSettled(
    files.map(async (file) => {
      if (
        file.includes("/vendor/") ||
        file.includes("/node_modules/") ||
        file.includes("/.turbo/") ||
        file.includes("/.source/") ||
        file.includes("/dist/") ||
        file.includes("/build/") ||
        file.includes("/.next/")
      ) {
        return null;
      }

      try {
        const text = await Bun.file(file).text();
        return { file, text };
      } catch {
        return null;
      }
    })
  );

  for (const result of fileContents) {
    if (result.status !== "fulfilled" || !result.value) {
      continue;
    }

    const { file, text } = result.value;

    // Check filename
    const stem = baseStem(file);
    if (
      !allowFrameworkFileStem(stem, file) &&
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

    const lines = text.split("\n");

    // Check for adjectives only in identifiers (not comments)
    // Skip comment-only lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }

      // Skip lines that are only comments
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        continue;
      }

      // Only check for adjectives in actual code (class/interface declarations)
      // This is handled by AST parsing for TS files, so skip here
      if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        continue;
      }

      // For JS/JSX, check class/interface declarations
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

    // Use AST parsing for TypeScript/JavaScript files
    if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      try {
        const sourceFile = ts.createSourceFile(
          file,
          text,
          ts.ScriptTarget.Latest,
          true
        );
        checkExportedSymbols(sourceFile, violations);
      } catch {
        // Skip files that can't be parsed (syntax errors, etc.)
      }
    } else {
      // Fallback to regex for JS/JSX files
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
          continue;
        }

        // Param names: flag underscores (except leading `_` for intentionally-unused).
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
  }

  return violations;
}

async function main(): Promise<void> {
  console.log("ALFRED Naming Convention Checker");

  const violations = await checkNames();

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
  await main();
}
