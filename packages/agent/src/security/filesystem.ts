import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
} from "node:fs";
import path from "node:path";

import { directoryFdPath, ensureFdInheritable, pathFromFd } from "./fd.js";

export interface PathResolutionOptions {
  noFollowSymlinks?: boolean;
}

export interface DirectoryHandle {
  fd: number;
  path: string;
  close(): void;
}

export type DirectoryAccessErrorCode =
  | "not_found"
  | "not_directory"
  | "disallowed";

export class DirectoryAccessError extends Error {
  constructor(
    public readonly code: DirectoryAccessErrorCode,
    message?: string
  ) {
    super(message ?? code);
    this.name = "DirectoryAccessError";
  }
}

export function safeRealpath(
  candidate: string,
  options?: PathResolutionOptions
): string | null {
  try {
    if (options?.noFollowSymlinks) {
      const stats = lstatSync(candidate);
      if (stats.isSymbolicLink()) {
        return null;
      }
    }
    return realpathSync(candidate);
  } catch {
    return null;
  }
}

export const DEFAULT_ALLOW_PREFIXES = (() => {
  const baseRaw = process.env.PWD?.trim() || "/workspace";
  const base = realpathSync(baseRaw);
  const raw = process.env.ORCH_ALLOW_CWD_PREFIXES;
  const extras =
    raw && raw.trim().length > 0
      ? raw
          .split(path.delimiter)
          .map((entry: string) => entry.trim())
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

  return [...prefixes];
})();

export function isWithinBase(
  base: string,
  target: string,
  options?: PathResolutionOptions
): boolean {
  const baseReal = safeRealpath(base, options);
  const targetReal = safeRealpath(target, options);
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
  allowedPrefixes: string[] = DEFAULT_ALLOW_PREFIXES,
  options?: PathResolutionOptions
): boolean {
  const resolved = safeRealpath(targetPath, options);
  // If file doesn't exist (e.g. creating new file), check parent directory
  if (!resolved) {
    const dir = path.dirname(targetPath);
    // Prevent infinite recursion if root doesn't exist (unlikely)
    if (dir === targetPath) {
      return false;
    }
    return isPathAllowed(dir, allowedPrefixes, options);
  }

  for (const prefix of allowedPrefixes) {
    if (isWithinBase(prefix, resolved, options)) {
      return true;
    }
  }
  return false;
}

type OpenDirectoryOptions = PathResolutionOptions & {
  allowedPrefixes?: string[];
};

const DIR_OPEN_FLAGS =
  (fsConstants.O_RDONLY ?? 0) |
  (fsConstants.O_DIRECTORY ?? 0) |
  (fsConstants.O_NOFOLLOW ?? 0);

export function openDirectorySecure(
  candidate: string,
  options?: OpenDirectoryOptions
): DirectoryHandle {
  const allowedPrefixes = options?.allowedPrefixes ?? DEFAULT_ALLOW_PREFIXES;
  const noFollow = options?.noFollowSymlinks ?? true;

  let fd: number;
  try {
    fd = openSync(candidate, DIR_OPEN_FLAGS);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const code: DirectoryAccessErrorCode =
      err?.code === "ENOTDIR" ? "not_directory" : "not_found";
    throw new DirectoryAccessError(code, err?.message);
  }

  try {
    const details = fstatSync(fd);
    if (!details.isDirectory()) {
      throw new DirectoryAccessError("not_directory");
    }

    const resolved = safeRealpath(candidate, {
      noFollowSymlinks: noFollow,
    });
    if (!resolved) {
      throw new DirectoryAccessError("not_found");
    }

    for (const prefix of allowedPrefixes) {
      if (isWithinBase(prefix, resolved, { noFollowSymlinks: noFollow })) {
        const handle: DirectoryHandle = {
          fd,
          path: resolved,
          close: () => {
            if (handle.fd >= 0) {
              closeSync(handle.fd);
              handle.fd = -1;
            }
          },
        };
        return handle;
      }
    }

    throw new DirectoryAccessError("disallowed");
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

/**
 * NOTE: This helper only exists for logging and diagnostics.
 * Do not pass its return value to Bun.spawn for security-sensitive code paths.
 * Use spawnWithSecureCwd so the validated fd stays authoritative.
 */
export function prepareCwdFromHandle(handle: DirectoryHandle): string {
  ensureFdInheritable(handle.fd);
  const derived = pathFromFd(handle.fd);
  if (derived) {
    return derived;
  }
  const fdPath = directoryFdPath(handle.fd);
  return fdPath ?? handle.path;
}
