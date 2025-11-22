import * as fs from "node:fs/promises";
// import * as path from "node:path";

export type ProjectType = "node" | "rust" | "python" | "go" | "unknown";

export type ProjectConfig = {
  type: ProjectType;
  testCommand: string;
  runCommand: string;
  installCommand: string;
  buildCommand: string;
};

const DEFAULT_CONFIG: ProjectConfig = {
  type: "unknown",
  testCommand: "echo 'No test command detected'",
  runCommand: "echo 'No run command detected'",
  installCommand: "echo 'No install command detected'",
  buildCommand: "echo 'No build command detected'",
};

export async function detectProject(root: string): Promise<ProjectConfig> {
  try {
    const files = await fs.readdir(root);

    if (files.includes("package.json")) {
      // Check for bun/yarn/npm/pnpm
      const hasBun = files.includes("bun.lockb") || files.includes("bun.lock");
      const hasYarn = files.includes("yarn.lock");
      const hasPnpm = files.includes("pnpm-lock.yaml");

      const runner = hasBun
        ? "bun"
        : hasYarn
          ? "yarn"
          : hasPnpm
            ? "pnpm"
            : "npm";
      const runPrefix = runner === "npm" ? "npm run" : runner;

      return {
        type: "node",
        testCommand: `${runPrefix} test`,
        runCommand: `${runPrefix} start`,
        installCommand: `${runner} install`,
        buildCommand: `${runPrefix} build`,
      };
    }

    if (files.includes("Cargo.toml")) {
      return {
        type: "rust",
        testCommand: "cargo test",
        runCommand: "cargo run",
        installCommand: "cargo build", // cargo build installs deps
        buildCommand: "cargo build --release",
      };
    }

    if (
      files.includes("pyproject.toml") ||
      files.includes("requirements.txt")
    ) {
      // Heuristic: prefer pytest
      return {
        type: "python",
        testCommand: "pytest",
        runCommand: "python main.py", // Generic guess
        installCommand: "pip install -r requirements.txt",
        buildCommand: "echo 'Python does not require build'",
      };
    }

    if (files.includes("go.mod")) {
      return {
        type: "go",
        testCommand: "go test ./...",
        runCommand: "go run .",
        installCommand: "go mod download",
        buildCommand: "go build",
      };
    }

    return DEFAULT_CONFIG;
  } catch (error) {
    void error;
    return DEFAULT_CONFIG;
  }
}
