import { redactSecrets } from "@alfred/agent/utils/redaction";

import type { ExecutorEvalsConfig } from "./types.js";

export function redactConfig(config: ExecutorEvalsConfig): ExecutorEvalsConfig {
  return {
    ...config,
    authz: config.authz ? "<redacted>" : undefined,
  };
}

export function snapshotEnv(allow: string[]): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const key of allow) {
    const v = process.env[key];
    if (!v) {
      continue;
    }
    out[key] = redactSecrets(v);
  }
  return out;
}
