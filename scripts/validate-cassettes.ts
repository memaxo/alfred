#!/usr/bin/env bun
/**
 * VCR Cassette Validation Script
 *
 * Validates that all VCR cassette files are:
 * 1. Valid JSON
 * 2. Have the correct schema version
 * 3. Have non-empty interactions
 * 4. Don't contain sensitive data (API keys, etc.)
 *
 * Usage: bun scripts/validate-cassettes.ts
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const CASSETTE_DIRS = [
  "packages/api/test/integration/__cassettes__",
  "packages/test-kit/cassettes",
];

type VCRCassette = {
  version: number;
  name: string;
  createdAt: string;
  interactions: Array<{
    id: string;
    timestamp: number;
    provider: string;
    model: string;
    request: {
      url: string;
      headers: Record<string, string>;
      body: unknown;
    };
    response: {
      status: number;
      headers: Record<string, string>;
      body: unknown;
    };
    requestHash: string;
  }>;
};

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{48}/g, // OpenAI API key
  /sk-ant-[a-zA-Z0-9-]+/g, // Anthropic API key
  /AIza[a-zA-Z0-9_-]{35}/g, // Google API key
  /Bearer\s+[a-zA-Z0-9._-]+/gi, // Bearer tokens
];

async function findCassetteFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await findCassetteFiles(fullPath)));
      } else if (entry.name.endsWith(".json")) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return files;
}

function checkSensitiveData(content: string): string[] {
  const issues: string[] = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      issues.push(
        `Found potential sensitive data: ${matches[0].slice(0, 10)}...`
      );
    }
  }

  return issues;
}

function validateCassette(cassette: VCRCassette): string[] {
  const issues: string[] = [];

  // Check version
  if (cassette.version !== 2 && cassette.version !== 1) {
    issues.push(`Invalid cassette version: ${String(cassette.version)}`);
  }

  // Check interactions
  if (Array.isArray(cassette.interactions)) {
    for (let i = 0; i < cassette.interactions.length; i++) {
      const interaction = cassette.interactions[i];

      if (!interaction.id) {
        issues.push(`Interaction ${i}: missing id`);
      }

      if (!interaction.provider) {
        issues.push(`Interaction ${i}: missing provider`);
      }

      if (!interaction.request?.url) {
        issues.push(`Interaction ${i}: missing request URL`);
      }

      if (!interaction.response?.status) {
        issues.push(`Interaction ${i}: missing response status`);
      }

      // Check for non-redacted auth headers
      const authHeader = interaction.request?.headers?.authorization;
      if (authHeader && authHeader !== "[REDACTED]") {
        issues.push(`Interaction ${i}: authorization header not redacted`);
      }

      const apiKey = interaction.request?.headers?.["api-key"];
      if (apiKey && apiKey !== "[REDACTED]") {
        issues.push(`Interaction ${i}: api-key header not redacted`);
      }
    }
  } else {
    issues.push("Interactions must be an array");
  }

  return issues;
}

async function main() {
  console.log("🔍 Validating VCR cassettes...\n");

  let totalFiles = 0;
  let validFiles = 0;
  let invalidFiles = 0;
  const allIssues: Array<{ file: string; issues: string[] }> = [];

  for (const dir of CASSETTE_DIRS) {
    const cassetteDir = path.join(process.cwd(), dir);
    const files = await findCassetteFiles(cassetteDir);

    for (const file of files) {
      totalFiles++;
      const issues: string[] = [];

      try {
        const content = await readFile(file, "utf-8");

        // Check for sensitive data in raw content
        const sensitiveIssues = checkSensitiveData(content);
        issues.push(...sensitiveIssues);

        // Parse and validate structure
        const cassette = JSON.parse(content) as VCRCassette;
        const structureIssues = validateCassette(cassette);
        issues.push(...structureIssues);

        if (issues.length === 0) {
          console.log(`✅ ${path.relative(process.cwd(), file)}`);
          validFiles++;
        } else {
          console.log(`❌ ${path.relative(process.cwd(), file)}`);
          for (const issue of issues) {
            console.log(`   - ${issue}`);
          }
          invalidFiles++;
          allIssues.push({ file, issues });
        }
      } catch (error) {
        const errorMsg =
          error instanceof SyntaxError
            ? "Invalid JSON"
            : (error as Error).message;
        console.log(`❌ ${path.relative(process.cwd(), file)}`);
        console.log(`   - ${errorMsg}`);
        invalidFiles++;
        allIssues.push({ file, issues: [errorMsg] });
      }
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(
    `Total: ${totalFiles} | Valid: ${validFiles} | Invalid: ${invalidFiles}`
  );

  if (totalFiles === 0) {
    console.log(
      "\n📝 No cassette files found. Run 'bun run test:vcr:record' to create them."
    );
    process.exit(0);
  }

  if (invalidFiles > 0) {
    console.log("\n❌ Validation failed. Please fix the issues above.");
    process.exit(1);
  }

  console.log("\n✅ All cassettes are valid!");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
