/**
 * Codex execution
 *
 * Async patterns:
 * - Fire-and-forget promises use: void safeWriter(...)
 * - Catch-ignored promises must log: .catch(err => logger.debug("...", { err }))
 * - OUTPUT_CAP_BYTES enforced incrementally via appendOutput()
 */

import { logger } from "@alfred/logger";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CodexExecuteArgs, CodexToolInput } from "./definition.js";

import { validateOutputSchema } from "./definition.js";
import { CodexError } from "./error.js";
import { assertAllowedDirectory } from "./policy.js";
import { executeWithCodexServer } from "./server.js";

const THREAD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface CodexTurnOptions {
  signal: AbortSignal;
  outputSchema?: unknown;
}

export function buildTurnOptions(
  input: CodexToolInput,
  signal: AbortSignal
): CodexTurnOptions {
  const options: CodexTurnOptions = { signal };

  if (input.outputSchema) {
    if (!validateOutputSchema(input.outputSchema)) {
      throw CodexError.parse("invalid_output_schema");
    }
    options.outputSchema = input.outputSchema;
  }

  return options;
}

type ThreadValidator = (threadId: string) => Promise<boolean>;

function resolveThreadValidator(): ThreadValidator | undefined {
  return createFilesystemThreadValidator(process.env.CODEX_HOME);
}

function resolveCodexSessionsDir(): string | null {
  const explicit = process.env.CODEX_HOME?.trim();
  if (explicit) {
    return path.join(path.resolve(explicit), "sessions");
  }
  const home = os.homedir();
  if (!home) {
    return null;
  }
  return path.join(home, ".codex", "sessions");
}

function createFilesystemThreadValidator(
  codexHomeOverride?: string
): ThreadValidator | undefined {
  const sessionsDir = codexHomeOverride
    ? path.join(path.resolve(codexHomeOverride), "sessions")
    : resolveCodexSessionsDir();

  if (!sessionsDir) {
    return;
  }

  return async (threadId: string) => {
    if (!THREAD_ID_PATTERN.test(threadId)) {
      return false;
    }

    const filePath = path.join(sessionsDir, `${threadId}.json`);
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return false;
      }
      logger.warn("codex_thread_validation_error", {
        err: error instanceof Error ? error.message : String(error),
        path: filePath,
        threadId,
      });
      return false;
    }
  };
}

export async function executeWithCodex({
  input,
  writer,
  signal,
}: CodexExecuteArgs) {
  const cwdHandle = assertAllowedDirectory(input.cw ?? process.cwd());
  try {
    const output = await executeWithCodexServer({
      cwdHandle,
      input,
      signal,
      writer,
    });
    return {
      artifacts: output.artifacts,
      result: output.result,
    };
  } finally {
    cwdHandle.close();
  }
}

export const __internals = {
  createFilesystemThreadValidatorForTests: (codexHome: string) =>
    createFilesystemThreadValidator(codexHome),
  resolveThreadValidator,
};
