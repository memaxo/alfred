import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

// Security: Only allow access within the project root
const PROJECT_ROOT = realpathSync.native(process.cwd());

function isWithinRoot(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function resolveWithinRoot(requestedPath: string) {
  const resolvedPath = path.resolve(PROJECT_ROOT, requestedPath);
  if (!isWithinRoot(PROJECT_ROOT, resolvedPath)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: Path is outside the project root.",
    });
  }
  return resolvedPath;
}

function validateExistingFilePath(requestedPath: string) {
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

function validateWriteFilePath(requestedPath: string) {
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

export const fsRouter = router({
  read: authedProcedure
    .use(
      requirePolicy("fs.read", (raw) => {
        const input = raw as { path?: unknown };
        return {
          kind: "file",
          id: typeof input.path === "string" ? input.path : "unknown",
        };
      })
    )
    .input(z.object({ path: z.string() }))
    .query(({ input }) => {
      try {
        const resolvedPath = resolveWithinRoot(input.path);

        if (!existsSync(resolvedPath)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found",
          });
        }

        const filePath = validateExistingFilePath(input.path);
        const stats = statSync(filePath);
        if (!stats.isFile()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Path is not a file",
          });
        }

        const content = readFileSync(filePath, "utf-8");
        return { content };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to read file: ${(error as Error).message}`,
        });
      }
    }),

  write: authedProcedure
    .use(
      requirePolicy("fs.write", (raw) => {
        const input = raw as { path?: unknown };
        return {
          kind: "file",
          id: typeof input.path === "string" ? input.path : "unknown",
        };
      })
    )
    .input(z.object({ path: z.string(), content: z.string() }))
    .mutation(({ input }) => {
      try {
        const filePath = validateWriteFilePath(input.path);
        writeFileSync(filePath, input.content, "utf-8");
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to write file: ${(error as Error).message}`,
        });
      }
    }),
});
