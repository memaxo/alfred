type MetaEnv = {
  DEV?: boolean;
  MODE?: string;
  PROD?: boolean;
};

type ImportMetaWithEnv = ImportMeta & {
  env?: MetaEnv;
};

function readNodeEnv(): string | undefined {
  const p = (globalThis as unknown as { process?: unknown }).process as
    | { env?: Record<string, unknown> }
    | undefined;
  const v = p?.env?.NODE_ENV;
  return typeof v === "string" ? v : undefined;
}

function readViteMode(): string | undefined {
  // Vite injects `import.meta.env` at build time. In non-Vite environments this
  // is simply `undefined`, so we keep it optional and runtime-guarded.
  const meta = import.meta as ImportMetaWithEnv;
  const mode = meta?.env?.MODE;
  if (typeof mode === "string" && mode.length > 0) {
    return mode;
  }
  if (meta?.env?.DEV === true) {
    return "development";
  }
  if (meta?.env?.PROD === true) {
    return "production";
  }
  return;
}

export function detectEnvironment(): string | undefined {
  return readNodeEnv() ?? readViteMode();
}

export function hasStdout(): boolean {
  const p = (globalThis as unknown as { process?: unknown }).process as
    | { stdout?: { write?: unknown; isTTY?: unknown } }
    | undefined;
  return typeof p?.stdout?.write === "function";
}

export function stdoutWrite(s: string): boolean {
  const p = (globalThis as unknown as { process?: unknown }).process as
    | { stdout?: { write?: (s: string) => boolean } }
    | undefined;
  try {
    return p?.stdout?.write?.(s) ?? false;
  } catch {
    return false;
  }
}

export function supportsAnsiColor(): boolean {
  const p = (globalThis as unknown as { process?: unknown }).process as
    | { stdout?: { isTTY?: unknown } }
    | undefined;
  return p?.stdout?.isTTY === true;
}
