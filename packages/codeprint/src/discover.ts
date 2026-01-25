/**
 * Fast file discovery with tiered fallback:
 * 1. git ls-files (fastest - uses git's index, ~10-50ms)
 * 2. fd (fast parallel traversal, ~100-300ms)
 * 3. rg --files (similar to fd, ~100-300ms)
 * 4. Bun.Glob (fallback, ~1000ms+)
 */

import { logger } from "@alfred/logger";

export type DiscoveryMethod = "git" | "fd" | "rg" | "glob";

export interface DiscoveryResult {
  files: string[];
  method: DiscoveryMethod;
  durationMs: number;
}

const EXTENSIONS = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"];

const IGNORE_PATTERNS = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".turbo",
  "coverage",
  "__snapshots__",
  ".tsbuild",
  "vendor",
];

/**
 * Discover files using the fastest available method
 */
export async function discoverFiles(
  workspace: string
): Promise<DiscoveryResult> {
  const start = performance.now();

  // Try git first (fastest for git repos)
  const gitResult = await tryGitLsFiles(workspace);
  if (gitResult) {
    const durationMs = performance.now() - start;
    logger.debug("codeprint_discover", {
      method: "git",
      files: gitResult.length,
      durationMs,
      workspace,
    });
    return { files: gitResult, method: "git", durationMs };
  }

  // Try fd (fast parallel walker)
  const fdResult = await tryFd(workspace);
  if (fdResult) {
    const durationMs = performance.now() - start;
    logger.debug("codeprint_discover", {
      method: "fd",
      files: fdResult.length,
      durationMs,
      workspace,
    });
    return { files: fdResult, method: "fd", durationMs };
  }

  // Try ripgrep --files
  const rgResult = await tryRipgrep(workspace);
  if (rgResult) {
    const durationMs = performance.now() - start;
    logger.debug("codeprint_discover", {
      method: "rg",
      files: rgResult.length,
      durationMs,
      workspace,
    });
    return { files: rgResult, method: "rg", durationMs };
  }

  // Fallback to Bun.Glob
  const globResult = await useGlob(workspace);
  const durationMs = performance.now() - start;
  logger.debug("codeprint_discover", {
    method: "glob",
    files: globResult.length,
    durationMs,
    workspace,
  });
  return { files: globResult, method: "glob", durationMs };
}

/**
 * git ls-files - reads from .git/index, extremely fast
 */
async function tryGitLsFiles(workspace: string): Promise<string[] | null> {
  try {
    // Check if it's a git repo
    const gitCheck = Bun.spawn(["git", "rev-parse", "--git-dir"], {
      cwd: workspace,
      stdout: "pipe",
      stderr: "pipe",
    });
    await gitCheck.exited;
    if (gitCheck.exitCode !== 0) {
      return null;
    }

    // Build extension patterns for git ls-files
    const extPatterns = EXTENSIONS.flatMap((ext) => [`*.${ext}`]);

    // Get tracked files + untracked (but not ignored)
    const proc = Bun.spawn(
      [
        "git",
        "ls-files",
        "--cached", // tracked files
        "--others", // untracked files
        "--exclude-standard", // respect .gitignore
        "--",
        ...extPatterns,
      ],
      {
        cwd: workspace,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return null;
    }

    const files = output
      .trim()
      .split("\n")
      .filter((f) => f.length > 0)
      .filter((f) => !shouldIgnore(f));

    return files;
  } catch {
    return null;
  }
}

/**
 * fd - fast parallel file finder
 */
async function tryFd(workspace: string): Promise<string[] | null> {
  try {
    // Check if fd is available
    const which = Bun.spawn(["which", "fd"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await which.exited;
    if (which.exitCode !== 0) {
      return null;
    }

    const args = [
      "--type",
      "f",
      "--hidden",
      ...EXTENSIONS.flatMap((ext) => ["-e", ext]),
      ...IGNORE_PATTERNS.flatMap((p) => ["--exclude", p]),
    ];

    const proc = Bun.spawn(["fd", ...args], {
      cwd: workspace,
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return null;
    }

    const files = output
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);

    return files;
  } catch {
    return null;
  }
}

/**
 * ripgrep --files - list files that would be searched
 */
async function tryRipgrep(workspace: string): Promise<string[] | null> {
  try {
    // Check if rg is available
    const which = Bun.spawn(["which", "rg"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await which.exited;
    if (which.exitCode !== 0) {
      return null;
    }

    const args = [
      "--files",
      "--hidden",
      ...EXTENSIONS.flatMap((ext) => ["-g", `*.${ext}`]),
      ...IGNORE_PATTERNS.flatMap((p) => ["-g", `!${p}/**`]),
    ];

    const proc = Bun.spawn(["rg", ...args], {
      cwd: workspace,
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return null;
    }

    const files = output
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);

    return files;
  } catch {
    return null;
  }
}

/**
 * Bun.Glob - fallback for non-git, no fd/rg systems
 */
async function useGlob(workspace: string): Promise<string[]> {
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}");
  const files: string[] = [];

  for await (const path of glob.scan({ cwd: workspace, onlyFiles: true })) {
    if (!shouldIgnore(path)) {
      files.push(path);
    }
  }

  return files;
}

function shouldIgnore(path: string): boolean {
  return IGNORE_PATTERNS.some(
    (p) => path.includes(`${p}/`) || path.startsWith(`${p}/`)
  );
}

/**
 * Check which discovery methods are available
 */
export async function getAvailableMethods(workspace: string): Promise<{
  git: boolean;
  fd: boolean;
  rg: boolean;
  glob: boolean;
}> {
  const [git, fd, rg] = await Promise.all([
    checkGit(workspace),
    checkFd(),
    checkRg(),
  ]);

  return { git, fd, rg, glob: true };
}

async function checkGit(workspace: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--git-dir"], {
      cwd: workspace,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

async function checkFd(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "fd"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

async function checkRg(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "rg"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}
