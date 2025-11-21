import { existsSync } from "node:fs";
import path from "node:path";

export type ProjectType = "node" | "rust" | "python" | "go" | "unknown";

export type ProjectConfig = {
  type: ProjectType;
  testCommand: string;
  runCommand: string;
  installCommand: string;
  buildCommand: string;
  extensions: string[];
};

export function detectProject(workspace: string): ProjectConfig {
  // Priority: Node > Rust > Go > Python
  // (Node is most common for us, but we should be robust)

  // 1. Node.js
  if (existsSync(path.join(workspace, "package.json"))) {
    // Check for lockfiles to determine package manager
    let pm = "npm";
    if (
      existsSync(path.join(workspace, "bun.lock")) ||
      existsSync(path.join(workspace, "bun.lockb"))
    ) {
      pm = "bun";
    } else if (existsSync(path.join(workspace, "pnpm-lock.yaml"))) {
      pm = "pnpm";
    } else if (existsSync(path.join(workspace, "yarn.lock"))) {
      pm = "yarn";
    }

    // Default scripts
    // We could parse package.json scripts to be smarter
    let testCmd = `${pm} test`;
    let runCmd = `${pm} start`;
    const installCmd = `${pm} install`;
    const buildCmd = `${pm} run build`;

    // Overrides for Bun
    if (pm === "bun") {
      testCmd = "bun test";
      runCmd = "bun run start";
    }

    return {
      type: "node",
      testCommand: testCmd,
      runCommand: runCmd,
      installCommand: installCmd,
      buildCommand: buildCmd,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    };
  }

  // 2. Rust
  if (existsSync(path.join(workspace, "Cargo.toml"))) {
    return {
      type: "rust",
      testCommand: "cargo test",
      runCommand: "cargo run",
      installCommand: "cargo build", // cargo build fetches deps
      buildCommand: "cargo build --release",
      extensions: [".rs", ".toml"],
    };
  }

  // 3. Go
  if (existsSync(path.join(workspace, "go.mod"))) {
    return {
      type: "go",
      testCommand: "go test ./...",
      runCommand: "go run .",
      installCommand: "go mod download",
      buildCommand: "go build -v ./...",
      extensions: [".go", ".mod"],
    };
  }

  // 4. Python
  if (
    existsSync(path.join(workspace, "pyproject.toml")) ||
    existsSync(path.join(workspace, "requirements.txt"))
  ) {
    // Detect runner? (poetry, pipenv, uv, pip)
    // Default to pip/python
    let testCmd = "python -m pytest";
    const runCmd = "python main.py"; // Guess
    let installCmd = "pip install -r requirements.txt";

    if (existsSync(path.join(workspace, "uv.lock"))) {
      installCmd = "uv sync";
      testCmd = "uv run pytest";
    }

    return {
      type: "python",
      testCommand: testCmd,
      runCommand: runCmd,
      installCommand: installCmd,
      buildCommand: "", // Python usually interprets
      extensions: [".py", ".toml", ".txt"],
    };
  }

  // Fallback
  return {
    type: "unknown",
    testCommand: "echo 'No test command detected'",
    runCommand: "echo 'No run command detected'",
    installCommand: "echo 'No install command detected'",
    buildCommand: "echo 'No build command detected'",
    extensions: [],
  };
}
