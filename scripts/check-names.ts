#!/usr/bin/env bun

/**
 * ALFRED Naming Convention Checker
 * Enforces single-word naming rules across the codebase
 *
 * Rules:
 * - Files: single-word names only (e.g., user.ts, not user-profile.ts)
 * - Classes: single-word names only (e.g., class User, not class UserProfile)
 * - Params: single-word names only (e.g., user, run, token)
 * - No adjectives: "enhanced", "improved", "better", "optimized", etc.
 */

// TODO: [Phase 15] Implement file name checking
// - Scan packages/**/*.ts files
// - Check for hyphens, underscores in file names (except test files)
// - Allow: tool/, flow/, pane/, rpc/ subdirectories

// TODO: [Phase 15] Implement class name checking
// - Parse TypeScript AST
// - Check class declarations for multi-word names
// - Check interface declarations

// TODO: [Phase 15] Implement param name checking
// - Parse function signatures
// - Check for multi-word parameter names
// - Allow: exceptions for external APIs

// TODO: [Phase 15] Implement forbidden adjective checking
// - Scan for: enhanced, improved, better, optimized, advanced, etc.
// - Report violations with file:line

// TODO: [Phase 15] Add CI integration
// - Exit with code 1 if violations found
// - Pretty print violations

interface Violation {
  file: string;
  line: number;
  type: "file" | "class" | "param" | "adjective";
  message: string;
}

function checkNames(): Violation[] {
  const violations: Violation[] = [];

  // TODO: Implement scanning logic

  return violations;
}

function main() {
  console.log("ALFRED Naming Convention Checker");
  console.log("TODO: [Phase 15] Implement name checking logic");

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
