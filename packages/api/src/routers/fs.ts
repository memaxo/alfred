import { statSync } from "node:fs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  resolveWithinProjectRoot,
  validateExistingFilePath,
  validateWriteFilePath,
} from "../fs/security";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

function getPolicyPath(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return "unknown";
  }
  const maybePath = (raw as Record<string, unknown>).path;
  return typeof maybePath === "string" ? maybePath : "unknown";
}

export const fsRouter = router({
  read: authedProcedure
    .use(
      requirePolicy("fs.read", (raw) => {
        return {
          kind: "file",
          id: getPolicyPath(raw),
        };
      })
    )
    .input(z.object({ path: z.string() }))
    .query(async ({ input }) => {
      try {
        const resolvedPath = resolveWithinProjectRoot(input.path);
        const file = Bun.file(resolvedPath);

        if (!(await file.exists())) {
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

        const content = await Bun.file(filePath).text();
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
        return {
          kind: "file",
          id: getPolicyPath(raw),
        };
      })
    )
    .input(z.object({ path: z.string(), content: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const filePath = validateWriteFilePath(input.path);
        await Bun.write(filePath, input.content);
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
