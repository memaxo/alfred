import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";

// Security: Only allow access within the project root
const PROJECT_ROOT = realpathSync.native(process.cwd());

function isWithinRoot(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function resolveWithinRoot(requestedPath: string): string {
  const resolvedPath = path.resolve(PROJECT_ROOT, requestedPath);
  if (!isWithinRoot(PROJECT_ROOT, resolvedPath)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: Path is outside the project root.",
    });
  }
  return resolvedPath;
}

export function validateExistingFilePath(requestedPath: string): string {
  const resolvedPath = resolveWithinRoot(requestedPath);
  const realPath = realpathSync.native(resolvedPath);
  if (!isWithinRoot(PROJECT_ROOT, realPath)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: Path resolves outside the project root.",
    });
  }
  return realPath;
}

export function validateWriteFilePath(requestedPath: string): string {
  const resolvedPath = resolveWithinRoot(requestedPath);
  const parentDir = path.dirname(resolvedPath);

  if (!existsSync(parentDir)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Parent directory does not exist",
    });
  }

  const parentStats = statSync(parentDir);
  if (!parentStats.isDirectory()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Parent path is not a directory",
    });
  }

  const parentRealPath = realpathSync.native(parentDir);
  if (!isWithinRoot(PROJECT_ROOT, parentRealPath)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: Parent directory resolves outside the project root.",
    });
  }

  if (existsSync(resolvedPath) && lstatSync(resolvedPath).isSymbolicLink()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: Refusing to write through a symlink.",
    });
  }

  return resolvedPath;
}

export function resolveWithinProjectRoot(requestedPath: string): string {
  return resolveWithinRoot(requestedPath);
}

