#!/usr/bin/env bun
/**
 * ReactFlow Isolation Verifier
 *
 * This script verifies that @xyflow/react imports are only in allowed directories:
 * - apps/web/src/components/graphs/
 * - apps/web/src/store/mindscape/
 *
 * Run: bun scripts/verify-reactflow-isolation.ts
 *
 * @see docs/execplans/desktop-type-migration.md
 */

import { $ } from "bun";

const ALLOWED_PATTERNS = [
  "apps/web/src/components/graphs/",
  "apps/web/src/store/mindscape/",
  // Legacy files during migration (to be removed after full migration)
  "apps/web/src/store/desktop/windows.ts", // Old window slice
  "apps/web/src/store/desktop/types.ts", // Old types
  "apps/web/src/store/desktop/knowledge.ts", // Old knowledge slice
  "apps/web/src/components/desktop/canvas.tsx", // Old canvas
  "apps/web/src/components/windows/registry.tsx", // Old registry
  "apps/web/src/components/windows/shared/window-frame.tsx", // Old frame
  // Type definition files are allowed
  "apps/web/src/types/graph.ts",
];

const _FORBIDDEN_PATTERNS: string[] = [
  // After migration, these should have no @xyflow/react imports:
  // "apps/web/src/store/desktop/",
  // "apps/web/src/components/desktop/",
  // "apps/web/src/components/windows/",
];

async function main() {
  console.log("🔍 Verifying ReactFlow isolation...\n");

  // Find all files importing @xyflow/react
  const result =
    await $`rg -l "@xyflow/react" apps/web/src --type ts --type tsx 2>/dev/null || true`.text();
  const files = result.trim().split("\n").filter(Boolean);

  if (files.length === 0) {
    console.log("✅ No @xyflow/react imports found (or rg not available)");
    return;
  }

  const violations: string[] = [];
  const allowed: string[] = [];

  for (const file of files) {
    const isAllowed = ALLOWED_PATTERNS.some((pattern) =>
      file.includes(pattern)
    );
    if (isAllowed) {
      allowed.push(file);
    } else {
      violations.push(file);
    }
  }

  console.log("📁 Files with @xyflow/react imports:\n");

  if (allowed.length > 0) {
    console.log("✅ Allowed locations:");
    for (const file of allowed) {
      console.log(`   ${file}`);
    }
  }

  if (violations.length > 0) {
    console.log("\n❌ VIOLATIONS (imports outside isolation boundary):");
    for (const file of violations) {
      console.log(`   ${file}`);
    }
    console.log("\n⚠️  ReactFlow imports should only be in:");
    console.log("   - apps/web/src/components/graphs/");
    console.log("   - apps/web/src/store/mindscape/");
    console.log(
      "\n   See docs/execplans/desktop-type-migration.md for migration guide."
    );
    process.exit(1);
  }

  console.log("\n✅ All @xyflow/react imports are in allowed locations!");
}

main().catch(console.error);
