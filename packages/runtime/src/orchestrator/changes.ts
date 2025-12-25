import type { FileChanges } from "./types.js";

/**
 * Detect file changes in the workspace since a specific point in time (or just current uncommitted changes).
 * Uses git to accurately track modified, created, and deleted files.
 */
export async function detectFileChanges(
  workspace: string,
  _since?: Date
): Promise<FileChanges> {
  try {
    // We use --name-status to get changed files.
    // If no 'since' is provided, we check uncommitted changes.
    // In our context, each wave usually leaves uncommitted changes.
    const proc = Bun.spawn(["git", "status", "--porcelain"], {
      cwd: workspace,
      stdout: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const modified: string[] = [];
    const created: string[] = [];
    const deleted: string[] = [];

    for (const line of output.split("\n")) {
      const status = line.slice(0, 2).trim();
      const path = line.slice(3).trim();

      if (!path) continue;

      if (status === "M") {
        modified.push(path);
      } else if (status === "??" || status === "A") {
        created.push(path);
      } else if (status === "D") {
        deleted.push(path);
      }
    }

    return { modified, created, deleted };
  } catch (error) {
    console.warn("Failed to detect file changes via git:", error);
    return { modified: [], created: [], deleted: [] };
  }
}

/**
 * Get a concise git diff of changes.
 */
export async function getGitDiffSummary(
  workspace: string,
  maxLines = 50
): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "diff", "--stat"], {
      cwd: workspace,
      stdout: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    return output.split("\n").slice(0, maxLines).join("\n");
  } catch {
    return "No diff available";
  }
}
