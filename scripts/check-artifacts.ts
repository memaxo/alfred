interface GitLsFilesResult {
  files: string[];
}

async function gitLsFiles(): Promise<GitLsFilesResult> {
  const proc = Bun.spawn(["git", "ls-files", "-z"], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).arrayBuffer();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`git_ls_files_failed: code=${exitCode} stderr=${stderr}`);
  }

  const bytes = new Uint8Array(stdout);
  const text = new TextDecoder().decode(bytes);
  const files = text
    .split("\0")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { files };
}

function isForbiddenTrackedArtifact(path: string): boolean {
  if (path.endsWith(".tsbuildinfo")) {
    return true;
  }

  if (path.endsWith(".log")) {
    return true;
  }

  if (path.endsWith(".DS_Store")) {
    return true;
  }

  // Directory artifacts that should never be committed.
  // Note: This checks TRACKED files only (git ls-files), so it won't fail on local caches.
  const forbiddenDir =
    /(^|\/)(node_modules|dist|build|coverage|\.turbo|playwright-report|test-results)\//;
  return forbiddenDir.test(path);
}

function formatList(files: string[]): string {
  return files.map((f) => `- ${f}`).join("\n");
}

async function main() {
  const { files } = await gitLsFiles();
  const bad = files.filter(isForbiddenTrackedArtifact);

  if (bad.length === 0) {
    // Keep output quiet in CI.
    return;
  }

  // Bun exits with non-zero when an uncaught error is thrown.
  throw new Error(
    `forbidden_generated_artifacts_tracked:\n${formatList(bad)}\n\nIf these are accidental, remove them from git history (or untrack them) and add to .gitignore as appropriate.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
