import { accessSync, constants as fsConstants, lstatSync } from "node:fs";
import path from "node:path";
import { logger } from "@alfred/metrics";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import {
  DEFAULT_ALLOW_PREFIXES,
  DirectoryAccessError,
  DirectoryHandle,
  openDirectorySecure,
} from "../../../security/filesystem.js";
import {
  CODEX_ENV_ALLOWLIST,
  DEFAULT_TIMEOUT_SEC,
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  MAX_TIMEOUT_SEC,
  type CodexToolInput,
  MCP_ENV_ALLOWLIST,
  type SandboxConfig,
} from "./definition.js";

export const DEFAULT_SANDBOX: SandboxConfig = {
  sandbox: "read-only",
  approval: "on-request",
};
export const WRITE_SANDBOX: SandboxConfig = {
  sandbox: "workspace-write",
  approval: "on-request",
};

type DirectoryAssertOptions = {
  noFollowSymlinks?: boolean;
};

export function assertAllowedDirectory(
  candidate: string,
  options?: DirectoryAssertOptions
): DirectoryHandle {
  try {
    return openDirectorySecure(candidate, {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
      noFollowSymlinks: options?.noFollowSymlinks ?? true,
    });
  } catch (error) {
    const isDirectoryError =
      error instanceof DirectoryAccessError &&
      error.code === "not_directory";
    const isFsNotDir =
      (error as NodeJS.ErrnoException | undefined)?.code === "ENOTDIR";
    if (isDirectoryError || isFsNotDir) {
      throw new Error("codex_invalid_cwd_not_directory");
    }
    try {
      if (lstatSync(candidate).isFile()) {
        throw new Error("codex_invalid_cwd_not_directory");
      }
    } catch {
      // ignore classification errors
    }
    throw new Error("codex_invalid_cwd");
  }
}

export function mapAutoToCodex(auto: CodexToolInput["auto"]): SandboxConfig {
  return auto === "read" ? DEFAULT_SANDBOX : WRITE_SANDBOX;
}

export function pickEnvCodex(custom: Record<string, string> | undefined) {
  const allowOpenAI = (process.env.ORCH_CODEX_ALLOW_OPENAI_KEY ?? "1") !== "0";
  const safeEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "",
  };

  for (const key of CODEX_ENV_ALLOWLIST) {
    const value = process.env[key];
    if (typeof value === "string" && value.length > 0) {
      safeEnv[key] = value;
    }
  }

  for (const name of MCP_ENV_ALLOWLIST) {
    const value = process.env[name];
    if (value) {
      safeEnv[name] = value;
    }
  }

  if (!safeEnv.CODEX_API_KEY && allowOpenAI && process.env.OPENAI_API_KEY) {
    safeEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }

  if (!custom) {
    return safeEnv;
  }

  const blockedCodexKeys: string[] = [];

  for (const [key, value] of Object.entries(custom)) {
    if (!key || typeof value !== "string") {
      continue;
    }
    if (key === "PATH") {
      continue;
    }
    if (key.startsWith("CODEX_")) {
      if (CODEX_ENV_ALLOWLIST.has(key)) {
        safeEnv[key] = value;
      } else {
        blockedCodexKeys.push(key);
      }
      continue;
    }
    if (MCP_ENV_ALLOWLIST.has(key)) {
      safeEnv[key] = value;
      continue;
    }
    if (allowOpenAI && key === "OPENAI_API_KEY") {
      safeEnv.OPENAI_API_KEY = value;
    }
  }

  if (blockedCodexKeys.length > 0) {
    logger.warn("codex_env_blocked", {
      count: blockedCodexKeys.length,
      keys: blockedCodexKeys,
    });
  }

  return safeEnv;
}

export function resolveExecutable(command: string) {
  if (path.isAbsolute(command)) {
    accessSync(command, fsConstants.X_OK);
    return command;
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue searching
    }
  }

  throw new Error("codex_binary_not_found");
}

export async function enforcePolicy(input: CodexToolInput) {
  const { claims } = await requireToolScopesAndPolicy(
    input.authz,
    ["droid.exec"],
    {
      action: "droid.exec",
      resource: {
        kind: "repo",
        id: input.cw ? path.resolve(input.cw) : undefined,
      },
      context: {
        auto: input.auto,
        memory_confidence: input.context?.confidence,
      },
    }
  );

  if (input.userId && input.userId !== claims.sub) {
    throw new Error("codex_session_user_mismatch");
  }

  input.userId = claims.sub;

  const hasElevation = Boolean(claims.elevated && claims.mfa === "passkey");
  const requestedTimeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;

  if (requestedTimeoutSec > MAX_TIMEOUT_SEC) {
    throw new Error("codex_timeout_exceeds_limit");
  }

  if ((input.auto === "medium" || input.auto === "high") && !hasElevation) {
    throw new Error("biometric_required");
  }

  if (
    requestedTimeoutSec > ELEVATED_TIMEOUT_THRESHOLD_SEC &&
    !hasElevation
  ) {
    throw new Error("codex_timeout_requires_elevation");
  }
}
