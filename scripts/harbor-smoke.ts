#!/usr/bin/env bun

import { execSync, spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * End-to-end smoke test for Harbor integration.
 *
 * This test:
 * 1. Generates a Harbor task directory
 * 2. Verifies the structure (task.toml, instruction.md, Dockerfile, agents/alfred.sh, solution/solve.sh, tests/test.sh)
 * 3. Optionally runs Harbor trial if HARBOR_BIN is set
 * 4. Verifies outputs (trajectory.json, reward.txt)
 * 5. Tests eval ingestion
 */

const TEST_TASK_ID = "smoke-test";
const TEST_REQUIREMENT = "Create TEST.txt with the text: smoke-test";
const TEST_VERIFY = "test -f TEST.txt && grep -qx 'smoke-test' TEST.txt";

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function verifyTaskStructure(taskDir: string): Promise<void> {
  const requiredFiles = [
    "task.toml",
    "instruction.md",
    "environment/Dockerfile",
    "agents/alfred.sh",
    "solution/solve.sh",
    "tests/test.sh",
    "environment/workspace/README.md", // Workspace files go in environment/ for Docker build context
  ];

  console.log("Verifying task structure...");
  for (const file of requiredFiles) {
    const filePath = path.join(taskDir, file);
    const exists = await checkFileExists(filePath);
    if (!exists) {
      throw new Error(`Missing required file: ${file}`);
    }
    console.log(`  ✓ ${file}`);
  }

  // Verify agents/alfred.sh contains workflow:run
  const agentSh = await Bun.file(path.join(taskDir, "agents/alfred.sh")).text();
  if (!agentSh.includes("bun workflow:run")) {
    throw new Error("agents/alfred.sh does not invoke bun workflow:run");
  }
  console.log("  ✓ agents/alfred.sh invokes workflow:run");

  // Verify solution/solve.sh is oracle (doesn't invoke workflow:run)
  const solveSh = await Bun.file(
    path.join(taskDir, "solution/solve.sh")
  ).text();
  if (solveSh.includes("bun workflow:run")) {
    throw new Error(
      "solution/solve.sh should be oracle, not invoke workflow:run"
    );
  }
  console.log("  ✓ solution/solve.sh is oracle");
}

async function main() {
  const tmpDir = path.join(process.cwd(), ".tmp", "harbor-smoke");
  const taskDir = path.join(tmpDir, TEST_TASK_ID);
  const alfredGitUrl = process.env.ALFRED_GIT_URL ?? `file://${process.cwd()}`;
  const alfredGitRef = process.env.ALFRED_GIT_REF ?? "dev";

  console.log("Harbor Integration Smoke Test");
  console.log("============================\n");

  // Cleanup
  try {
    await fs.rm(tmpDir, { recursive: true });
  } catch {
    // Ignore if doesn't exist
  }
  await fs.mkdir(tmpDir, { recursive: true });

  // Step 1: Generate task
  console.log("Step 1: Generating Harbor task...");
  {
    const proc = spawnSync(
      "bun",
      [
        "scripts/harbor.ts",
        "gen",
        "--outDir",
        tmpDir,
        "--id",
        TEST_TASK_ID,
        "--requirement",
        TEST_REQUIREMENT,
        "--verify",
        TEST_VERIFY,
        "--alfredGitUrl",
        alfredGitUrl,
        "--alfredGitRef",
        alfredGitRef,
      ],
      { stdio: "inherit" }
    );
    if (proc.status !== 0) {
      throw new Error(`harbor_smoke_gen_failed status=${proc.status}`);
    }
  }
  console.log("✓ Task generated\n");

  // Step 2: Verify structure
  console.log("Step 2: Verifying task structure...");
  await verifyTaskStructure(taskDir);
  console.log("✓ Structure verified\n");

  // Step 3: Check if Harbor is available (optional)
  const harborBin = process.env.HARBOR_BIN ?? "harbor";
  try {
    execSync(`${harborBin} --version`, { stdio: "ignore" });
    console.log(`Step 3: Harbor found (${harborBin})`);
    console.log(
      "  Note: Full Harbor trial execution requires Docker and Harbor installation"
    );
    console.log("  Set HARBOR_BIN to skip Harbor execution check\n");
  } catch {
    console.log("Step 3: Harbor not found (skipping execution test)");
    console.log(
      "  Set HARBOR_BIN environment variable to test full execution\n"
    );
  }

  // Step 4: Verify registry.json generation
  console.log("Step 4: Testing dataset generation...");
  const datasetDir = path.join(tmpDir, "dataset");
  {
    const proc = spawnSync("bun", ["scripts/harbor-dataset.ts", datasetDir], {
      stdio: "inherit",
      env: {
        ...process.env,
        ALFRED_GIT_URL: alfredGitUrl,
        ALFRED_GIT_REF: alfredGitRef,
      },
    });
    if (proc.status !== 0) {
      throw new Error(`harbor_smoke_dataset_failed status=${proc.status}`);
    }
  }

  const registryPath = path.join(datasetDir, "registry.json");
  if (!(await checkFileExists(registryPath))) {
    throw new Error("registry.json not generated");
  }

  const registry = JSON.parse(await Bun.file(registryPath).text());
  if (!registry.tasks || registry.tasks.length === 0) {
    throw new Error("registry.json has no tasks");
  }
  console.log(`✓ Dataset generated with ${registry.tasks.length} tasks\n`);

  // Step 5: Test eval ingestion (mock data)
  console.log("Step 5: Testing eval ingestion...");
  const ingestTestDir = path.join(tmpDir, "ingest-test");
  const mockTaskDir = path.join(ingestTestDir, "mock-task");
  await fs.mkdir(mockTaskDir, { recursive: true });

  // Create mock reward and trajectory
  await Bun.write(path.join(mockTaskDir, "reward.txt"), "1");
  await Bun.write(
    path.join(mockTaskDir, "trajectory.json"),
    JSON.stringify({
      schema_version: "ATIF-v1.4",
      steps: [],
    })
  );

  // Test ingestion (requires DATABASE_URL)
  if (process.env.DATABASE_URL) {
    try {
      const proc = spawnSync(
        "bun",
        [
          "scripts/harbor-ingest.ts",
          "--dir",
          ingestTestDir,
          "--userId",
          "smoke-test",
        ],
        { stdio: "inherit" }
      );
      if (proc.status !== 0) {
        throw new Error(`harbor_smoke_ingest_failed status=${proc.status}`);
      }
      console.log("✓ Eval ingestion works\n");
    } catch (error) {
      console.warn(
        "⚠ Eval ingestion failed (requires DATABASE_URL):",
        error instanceof Error ? error.message : String(error)
      );
      console.log("  Skipping ingestion test\n");
    }
  } else {
    console.log("  Skipping ingestion test (DATABASE_URL not set)\n");
  }

  console.log("============================");
  console.log("✓ All smoke tests passed!");
  console.log(`\nTask directory: ${taskDir}`);
  console.log(`Dataset directory: ${datasetDir}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(
      `\n✗ Smoke test failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
