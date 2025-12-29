/**
 * CLI Command Dispatcher
 *
 * Routes commands from the registry to their handlers.
 * Supports namespaced commands (e.g., voice:test-stt) and
 * validates arguments using Zod schemas.
 */

import type { z } from "zod";
import type { getRegistry } from "../registry";

type Registry = Awaited<ReturnType<typeof getRegistry>>;

type ParsedArgs = {
  flags: Record<string, string | boolean | number>;
  positional: string[];
};

/**
 * Parse CLI arguments into flags and positional args.
 *
 * Supports:
 * - --flag value
 * - --flag=value
 * - --boolean-flag
 * - positional args
 */
export function parseArgs(args: string[]): ParsedArgs {
  const flags: ParsedArgs["flags"] = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    // Handle --flag=value syntax
    if (arg.startsWith("--") && arg.includes("=")) {
      const eqIndex = arg.indexOf("=");
      const key = arg.slice(2, eqIndex);
      const value = arg.slice(eqIndex + 1);
      flags[key] = parseValue(value);
      continue;
    }

    // Handle --flag value syntax
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = parseValue(nextArg);
        i++; // Skip next arg
      } else {
        // Boolean flag
        flags[key] = true;
      }
      continue;
    }

    // Handle -f value syntax
    if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = parseValue(nextArg);
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }

    // Positional argument
    positional.push(arg);
  }

  return { flags, positional };
}

/**
 * Parse a string value into appropriate type.
 */
function parseValue(value: string): string | boolean | number {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  const num = Number(value);
  if (!Number.isNaN(num)) {
    return num;
  }

  return value;
}

/**
 * Dispatch a command to its handler.
 */
export async function dispatchCommand(
  command: string,
  args: string[],
  registry: Registry
): Promise<void> {
  // Find command by name (supports namespaced like "voice:test-stt")
  const cmd = registry.findCommand(command);

  if (!cmd) {
    throw new CommandNotFoundError(command, registry);
  }

  const parsed = parseArgs(args);

  // Merge positional args into flags (for simple cases)
  // First positional becomes first schema key, etc.
  const mergedArgs = { ...parsed.flags };
  if (parsed.positional.length > 0 && cmd.args) {
    const schemaKeys = getSchemaKeys(cmd.args);
    parsed.positional.forEach((value, index) => {
      const key = schemaKeys[index];
      if (key && !(key in mergedArgs)) {
        mergedArgs[key] = parseValue(value);
      }
    });
  }

  // Validate with Zod schema if available
  if (cmd.args) {
    const result = cmd.args.safeParse(mergedArgs);
    if (!result.success) {
      throw new ValidationError(command, result.error);
    }
    await cmd.handler(result.data);
  } else {
    await cmd.handler(mergedArgs);
  }
}

/**
 * Get keys from a Zod schema (best effort).
 */
function getSchemaKeys(schema: z.ZodType): string[] {
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  if (shape && typeof shape === "object") {
    return Object.keys(shape);
  }
  return [];
}

/**
 * Format help for a command.
 */
export function formatCommandHelp(command: string, registry: Registry): string {
  const cmd = registry.findCommand(command);

  if (!cmd) {
    return `Unknown command: ${command}`;
  }

  const lines: string[] = [
    `Usage: alfred ${command} [options]`,
    "",
    cmd.description || "No description available.",
    "",
  ];

  if (cmd.args) {
    lines.push("Options:");
    const shape = (cmd.args as z.ZodObject<z.ZodRawShape>).shape;
    if (shape && typeof shape === "object") {
      for (const [key, value] of Object.entries(shape)) {
        const zodValue = value as z.ZodTypeAny;
        const desc = zodValue.description || "";
        const isOptional = zodValue.isOptional?.() ?? false;
        const required = isOptional ? "" : " (required)";
        lines.push(`  --${key}${required}  ${desc}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * List all available commands grouped by package.
 */
export function listCommands(registry: Registry): string {
  const commands = registry.getAllCommands();
  const byCategory: Record<string, typeof commands> = {};

  for (const cmd of commands) {
    const category = cmd.category || "general";
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(cmd);
  }

  const lines: string[] = ["Available Commands:", ""];

  for (const [category, cmds] of Object.entries(byCategory).sort()) {
    lines.push(`  ${category}:`);
    for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
      const desc = cmd.description || "";
      lines.push(`    ${cmd.name.padEnd(20)} ${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class CommandNotFoundError extends Error {
  suggestions: string[];

  constructor(command: string, registry: Registry) {
    super(`Unknown command: ${command}`);
    this.name = "CommandNotFoundError";
    this.suggestions = findSimilarCommands(command, registry);
  }
}

export class ValidationError extends Error {
  zodError: z.ZodError;

  constructor(command: string, error: z.ZodError) {
    super(`Invalid arguments for ${command}: ${error.message}`);
    this.name = "ValidationError";
    this.zodError = error;
  }
}

/**
 * Find commands similar to the given name (fuzzy match).
 */
function findSimilarCommands(name: string, registry: Registry): string[] {
  const commands = registry.getAllCommands();
  const similar: Array<{ name: string; distance: number }> = [];

  for (const cmd of commands) {
    const distance = levenshteinDistance(name, cmd.name);
    if (distance <= 3) {
      similar.push({ name: cmd.name, distance });
    }
  }

  return similar
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((s) => s.name);
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  // Initialize matrix with proper dimensions
  const matrix: number[][] = Array.from({ length: b.length + 1 }, () =>
    Array.from({ length: a.length + 1 }, () => 0)
  );

  const firstRow = matrix[0];
  if (!firstRow) {
    return Math.max(a.length, b.length);
  }

  // Fill first column
  for (let i = 0; i <= b.length; i++) {
    const row = matrix[i];
    if (!row) {
      continue;
    }
    row[0] = i;
  }
  // Fill first row
  for (let j = 0; j <= a.length; j++) {
    firstRow[j] = j;
  }

  // Calculate distances
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const row = matrix[i];
      const prevRow = matrix[i - 1];
      if (!(row && prevRow)) {
        continue;
      }
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        row[j] = prevRow[j - 1] ?? 0;
      } else {
        const sub = (prevRow[j - 1] ?? 0) + 1; // substitution
        const ins = (row[j - 1] ?? 0) + 1; // insertion
        const del = (prevRow[j] ?? 0) + 1; // deletion
        row[j] = Math.min(sub, ins, del);
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow?.[a.length] ?? Math.max(a.length, b.length);
}
