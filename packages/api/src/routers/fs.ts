import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// Security: Only allow access within the project root
const PROJECT_ROOT = process.cwd();

function validatePath(requestedPath: string) {
  const resolvedPath = path.resolve(PROJECT_ROOT, requestedPath);

  // Ensure the path is within the project root
  if (!resolvedPath.startsWith(PROJECT_ROOT)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: Path is outside the project root.",
    });
  }

  return resolvedPath;
}

export const fsRouter = router({
  read: authedProcedure
    .input(z.object({ path: z.string() }))
    .query(({ input }) => {
      try {
        const filePath = validatePath(input.path);

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
        const filePath = validatePath(input.path);
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
