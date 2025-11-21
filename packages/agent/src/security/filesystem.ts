import { realpathSync } from "node:fs";
import path from "node:path";

export function safeRealpath(candidate: string): string | null {
  try {
    return realpathSync(candidate);
  } catch {
    return null;
  }
}

export const DEFAULT_ALLOW_PREFIXES = (() => {
  const base = realpathSync(process.cwd());
  const raw = process.env.ORCH_ALLOW_CWD_PREFIXES;
  const extras =
    raw && raw.trim().length > 0
      ? raw
          .split(path.delimiter)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

  const prefixes = new Set<string>([base]);

  for (const entry of extras) {
    try {
      const absolute = path.isAbsolute(entry)
        ? entry
        : path.resolve(base, entry);
      prefixes.add(realpathSync(absolute));
    } catch {
      // Ignore invalid entries
    }
  }

  return Array.from(prefixes);
})();

export function isWithinBase(base: string, target: string): boolean {
  const baseReal = safeRealpath(base);
  const targetReal = safeRealpath(target);
  if (!(baseReal && targetReal)) {
    return false;
  }
  const relative = path.relative(baseReal, targetReal);
  return (
    relative === "" || !(relative.startsWith("..") || path.isAbsolute(relative))
  );
}

export function isPathAllowed(
  targetPath: string,
  allowedPrefixes: string[] = DEFAULT_ALLOW_PREFIXES
): boolean {
  const resolved = safeRealpath(targetPath);
  // If file doesn't exist (e.g. creating new file), check parent directory
  if (!resolved) {
    const dir = path.dirname(targetPath);
    // Prevent infinite recursion if root doesn't exist (unlikely)
    if (dir === targetPath) {
      return false;
    }
    return isPathAllowed(dir, allowedPrefixes);
  }

  for (const prefix of allowedPrefixes) {
    if (isWithinBase(prefix, resolved)) {
      return true;
    }
  }
  return false;
}
