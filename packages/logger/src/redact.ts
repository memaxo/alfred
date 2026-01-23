const REDACT = "[REDACTED]";

const secretKeyParts = [
  "token",
  "password",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "privatekey",
  "private_key",
] as const;

function normKey(k: string): string {
  return k.toLowerCase();
}

function readNodeEnv(name: string): string | undefined {
  const p = (globalThis as unknown as { process?: unknown }).process as
    | { env?: Record<string, unknown> }
    | undefined;
  const v = p?.env?.[name];
  return typeof v === "string" ? v : undefined;
}

function readViteEnv(name: string): string | undefined {
  // Vite's module runner throws on dynamic access of `import.meta.env`:
  // `import.meta.env[name]` is forbidden. Only literal property reads are allowed.
  // Keep this function intentionally narrow and add new keys explicitly.
  const meta = import.meta as unknown as {
    env?: { ALFRED_LOG_REDACT?: string; LOG_REDACT?: string };
  };
  const env = meta?.env;
  if (!env) {
    return undefined;
  }
  if (name === "ALFRED_LOG_REDACT") {
    return typeof env.ALFRED_LOG_REDACT === "string"
      ? env.ALFRED_LOG_REDACT
      : undefined;
  }
  if (name === "LOG_REDACT") {
    return typeof env.LOG_REDACT === "string" ? env.LOG_REDACT : undefined;
  }
  return undefined;
}

function redactionDisabled(): boolean {
  const v = readNodeEnv("ALFRED_LOG_REDACT") ?? readNodeEnv("LOG_REDACT") ??
    readViteEnv("ALFRED_LOG_REDACT") ?? readViteEnv("LOG_REDACT");
  if (!v) {
    return false;
  }
  const nv = v.toLowerCase();
  return nv === "0" || nv === "false" || nv === "no" || nv === "off";
}

export function shouldRedactKey(k: string): boolean {
  if (redactionDisabled()) {
    return false;
  }
  const nk = normKey(k);
  // IDs are almost always safe and extremely useful for debugging.
  if (nk.endsWith("id") || nk.endsWith("ids")) {
    return false;
  }
  for (const part of secretKeyParts) {
    if (nk.includes(part)) {
      return true;
    }
  }
  return false;
}

export function redactValue(): string {
  return REDACT;
}
