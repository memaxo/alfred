import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// Security: Only allow access within the project root
const PROJECT_ROOT = path.resolve(process.cwd());
const PROJECT_ROOT_REAL = realpathSync(PROJECT_ROOT);

function isWithinProjectRoot(candidatePath: string): boolean {
  const rel = path.relative(PROJECT_ROOT_REAL, candidatePath);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function validateResolvedPath(resolvedPath: string) {
  if (!isWithinProjectRoot(resolvedPath)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: Path is outside the project root.",
    });
  }
}

function validatePathForRead(requestedPath: string) {
  const resolvedPath = path.resolve(PROJECT_ROOT_REAL, requestedPath);
  validateResolvedPath(resolvedPath);

  if (existsSync(resolvedPath)) {
    const real = realpathSync(resolvedPath);
    validateResolvedPath(real);
  }
  return resolvedPath;
}

function validatePathForWrite(requestedPath: string) {
  const resolvedPath = path.resolve(PROJECT_ROOT_REAL, requestedPath);
  validateResolvedPath(resolvedPath);

  const parent = path.dirname(resolvedPath);
  if (existsSync(parent)) {
    const parentReal = realpathSync(parent);
    validateResolvedPath(parentReal);
  }

  if (existsSync(resolvedPath)) {
    const real = realpathSync(resolvedPath);
    validateResolvedPath(real);
  }

  return resolvedPath;
}

export const fsRouter = router({
  read: authedProcedure
    .input(z.object({ path: z.string() }))
    .query(({ input }) => {
      try {
        const filePath = validatePathForRead(input.path);

        if (!existsSync(filePath)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found",
          });
        }

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
    .input(z.object({ path: z.string(), content: z.string() }))
    .mutation(({ input }) => {
      try {
        const filePath = validatePathForWrite(input.path);
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
