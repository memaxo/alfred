import { TRPCError } from "@trpc/server";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
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

export type TreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
};

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  modified?: string;
};

export const fsRouter = router({
  read: authedProcedure
    .use(
      requirePolicy("fs.read", (raw) => ({
        kind: "file",
        id: getPolicyPath(raw),
      }))
    )
    .input(z.object({ path: z.string() }))
    .query(async ({ input }) => {
      try {
        const filePath = validateExistingFilePath(input.path);

        // Check file type first (statSync works on directories too)
        let stats: ReturnType<typeof statSync> | null;
        try {
          stats = statSync(filePath);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code === "ENOENT") {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "File not found",
            });
          }
          throw error;
        }

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
      requirePolicy("fs.write", (raw) => ({
        kind: "file",
        id: getPolicyPath(raw),
      }))
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

  // ─────────────────────────────────────────────────────────────────────────
  // Directory listing procedures
  // ─────────────────────────────────────────────────────────────────────────

  list: authedProcedure
    .use(
      requirePolicy("fs.read", (raw) => ({
        kind: "file",
        id: getPolicyPath(raw),
      }))
    )
    .input(
      z.object({
        path: z.string(),
        showHidden: z.boolean().default(false),
      })
    )
    .query(({ input }) => {
      try {
        const dirPath = validateExistingFilePath(input.path);
        const stats = statSync(dirPath);

        if (!stats.isDirectory()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Path is not a directory",
          });
        }

        const entries = readdirSync(dirPath, { withFileTypes: true });
        const files: FileEntry[] = [];

        for (const entry of entries) {
          // Skip hidden files unless requested
          if (!input.showHidden && entry.name.startsWith(".")) {
            continue;
          }

          const entryPath = path.join(dirPath, entry.name);
          let size: number | undefined;
          let modified: string | undefined;

          try {
            const entryStat = statSync(entryPath);
            size = entry.isFile() ? entryStat.size : undefined;
            modified = entryStat.mtime.toISOString();
          } catch {
            // Skip entries we can't stat
          }

          files.push({
            name: entry.name,
            path: entryPath,
            type: entry.isDirectory() ? "folder" : "file",
            size,
            modified,
          });
        }

        // Sort: folders first, then alphabetically
        files.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        return { files };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const err = error as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Directory not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list directory: ${(error as Error).message}`,
        });
      }
    }),

  tree: authedProcedure
    .use(
      requirePolicy("fs.read", (raw) => ({
        kind: "file",
        id: getPolicyPath(raw),
      }))
    )
    .input(
      z.object({
        path: z.string(),
        depth: z.number().int().min(1).max(10).default(3),
        showHidden: z.boolean().default(false),
      })
    )
    .query(({ input }) => {
      try {
        const rootPath = validateExistingFilePath(input.path);
        const stats = statSync(rootPath);

        if (!stats.isDirectory()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Path is not a directory",
          });
        }

        const tree = buildTree(rootPath, input.depth, input.showHidden, 0);
        return { tree };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        const err = error as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Directory not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to build tree: ${(error as Error).message}`,
        });
      }
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function buildTree(
  dirPath: string,
  maxDepth: number,
  showHidden: boolean,
  currentDepth: number
): TreeNode[] {
  if (currentDepth >= maxDepth) {
    return [];
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      // Skip hidden files unless requested
      if (!showHidden && entry.name.startsWith(".")) {
        continue;
      }

      // Skip common non-code directories
      if (
        entry.isDirectory() &&
        [
          "node_modules",
          ".git",
          "dist",
          "build",
          ".next",
          "__pycache__",
        ].includes(entry.name)
      ) {
        continue;
      }

      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: entryPath,
          type: "folder",
          children: buildTree(
            entryPath,
            maxDepth,
            showHidden,
            currentDepth + 1
          ),
        });
      } else {
        nodes.push({
          name: entry.name,
          path: entryPath,
          type: "file",
        });
      }
    }

    // Sort: folders first, then alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch {
    // If we can't read a directory, return empty array
    return [];
  }
}
