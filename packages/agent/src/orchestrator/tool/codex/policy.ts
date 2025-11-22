import { accessSync, constants as fsConstants, statSync } from "node:fs";
import path from "node:path";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
  safeRealpath,
} from "../../../security/filesystem.js";
import {
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

export function assertAllowedDirectory(candidate: string) {
  const resolved = safeRealpath(candidate);
  if (!resolved) {
    throw new Error("codex_invalid_cwd");
  }
  for (const prefix of DEFAULT_ALLOW_PREFIXES) {
    if (isWithinBase(prefix, resolved)) {
      const stats = statSync(resolved);
      if (!stats.isDirectory()) {
        throw new Error("codex_invalid_cwd_not_directory");
      }
      return resolved;
    }
  }
  throw new Error("codex_invalid_cwd");
}

export function mapAutoToCodex(auto: CodexToolInput["auto"]): SandboxConfig {
  return auto === "read" ? DEFAULT_SANDBOX : WRITE_SANDBOX;
}

export function pickEnvCodex(custom: Record<string, string> | undefined) {
  const allowOpenAI = (process.env.ORCH_CODEX_ALLOW_OPENAI_KEY ?? "1") !== "0";
  const safeEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "",
  };

  if (process.env.CODEX_API_KEY) {
    safeEnv.CODEX_API_KEY = process.env.CODEX_API_KEY;
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

  for (const [key, value] of Object.entries(custom)) {
    if (!key || typeof value !== "string") {
      continue;
    }
    if (key === "PATH") {
      continue;
    }
    if (key.startsWith("CODEX_")) {
      safeEnv[key] = value;
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
      },
    }
  );

  if (
    (input.auto === "medium" || input.auto === "high") &&
    (!claims.elevated || claims.mfa !== "passkey")
  ) {
    throw new Error("biometric_required");
  }
}
