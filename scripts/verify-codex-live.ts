/**
 * Level-4 Verification: Codex live-run + durable logs
 *
 * Runs by default (skip explicitly with RUN_CODEX_LIVE=0).
 *
 * Verifies:
 * - real codex streaming execution completes (non-interactive, never hangs)
 * - artifacts are created inside an isolated workspace (Docker container)
 * - resume semantics work (same session/thread across 2 prompts)
 * - codex_runs + codex_events are persisted and searchable in Postgres
 *
 * Prerequisites:
 * - Docker running with alfred-postgres container
 * - Migrations applied (bun run db:migrate)
 * - CODEX_API_KEY or OPENAI_API_KEY set
 * - AGENT_ED25519_PRIVATE and AGENT_ED25519_PUBLIC_PEM set
 * - Codex binary available (CODEX_BIN or PATH)
 */

import { randomUUID } from "node:crypto";
import { accessSync, constants as fsConstants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { issueAccessToken } from "@alfred/auth/token";
import { redactSecrets } from "@alfred/agent/utils/redaction";
import {
  cleanupCodexLiveWorkspace,
  createCodexLiveWorkspace,
  runCodexLiveInWorkspace,
} from "@alfred/test-kit/codex";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`missing_env:${name}`);
  }
  return v.trim();
}

function ensureCodexApiKey(): void {
  // Codex can use either CODEX_API_KEY or OPENAI_API_KEY. To maximize compatibility
  // with different Codex runtimes, we alias OPENAI_API_KEY -> CODEX_API_KEY when absent.
  // This is done in-process to avoid mutating .env files.
  const codex = process.env.CODEX_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (!codex && openai) {
    process.env.CODEX_API_KEY = openai;
    console.log("NOTE: Using OPENAI_API_KEY as CODEX_API_KEY (runtime alias).");
  }
  if (!process.env.CODEX_API_KEY?.trim() && !process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("missing_env:CODEX_API_KEY_or_OPENAI_API_KEY");
  }
}

async function checkDockerAvailable(): Promise<void> {
  try {
    const proc = Bun.spawn(["docker", "ps"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      if (stderr.includes("Cannot connect to the Docker daemon")) {
        throw new Error(
          "docker_daemon_not_running: Start Docker Desktop with 'open -a Docker' and wait for it to be ready."
        );
      }
      throw new Error(`docker_check_failed: exit ${exitCode}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("docker_")) {
      throw error;
    }
    throw new Error(
      "docker_not_available: Install Docker Desktop or ensure 'docker' is in PATH."
    );
  }
}

async function checkPostgresAvailable(databaseUrl: string): Promise<void> {
  try {
    // Quick TCP check before attempting full connection
    const url = new URL(databaseUrl);
    const host = url.hostname || "localhost";
    const port = Number(url.port) || 5432;

    const proc = Bun.spawn(["docker", "exec", "alfred-postgres", "pg_isready", "-U", "alfred"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(
        `postgres_not_ready: Container alfred-postgres is not responding. ` +
        `Start it with 'bun run db:start' and wait for health check.`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("postgres_")) {
      throw error;
    }
    throw new Error(
      `postgres_check_failed: Unable to verify Postgres availability. ` +
      `Ensure Docker is running and container alfred-postgres exists.`
    );
  }
}

function checkCodexBinaryAvailable(): string {
  const override = process.env.CODEX_BIN?.trim();
  if (override) {
    try {
      accessSync(override, fsConstants.X_OK);
      return override;
    } catch {
      throw new Error(
        `codex_binary_not_executable: CODEX_BIN=${override} is not executable. ` +
        `Check file permissions or path.`
      );
    }
  }

  const candidates = [
    path.resolve(process.cwd(), ".cache", "codex", "bin", "codex"),
    path.resolve(process.cwd(), "vendor", "codex", "target", "release", "codex"),
    path.resolve(process.cwd(), "vendor", "codex", "target", "debug", "codex"),
  ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  // Check PATH
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, "codex");
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error(
    `codex_binary_not_found: Could not find 'codex' executable. ` +
    `Set CODEX_BIN=/path/to/codex or ensure 'codex' is in PATH. ` +
    `Build with: cd vendor/codex && cargo build --release`
  );
}

async function main() {
  console.log("=== Codex Live Verification ===\n");

  if (process.env.RUN_CODEX_LIVE === "0") {
    console.log("Skipping codex live verification (RUN_CODEX_LIVE=0).");
    return;
  }

  // Live verification must be non-interactive; otherwise Codex can block waiting
  // for approval prompts in a headless context.
  const existingApproval = process.env.ORCH_CODEX_APPROVAL;
  if (!existingApproval) {
    process.env.ORCH_CODEX_APPROVAL = "never";
    console.log("✓ Non-interactive mode enabled (ORCH_CODEX_APPROVAL=never)");
  } else {
    console.log(`✓ Using configured approval mode (ORCH_CODEX_APPROVAL=${existingApproval})`);
    if (existingApproval !== "never") {
      console.log("  NOTE: codex exec mode ignores non-'never' approval modes; prompts will not appear");
    }
  }

  // Step 1: Check Codex binary availability first (fast, no network)
  const codexBin = checkCodexBinaryAvailable();
  console.log(`✓ Codex binary found: ${codexBin}`);

  // Step 2: Codex API key (runtime alias OPENAI_API_KEY → CODEX_API_KEY)
  ensureCodexApiKey();
  console.log("✓ API key configured");

  // Step 3: Tool token signing keys
  requiredEnv("AGENT_ED25519_PRIVATE");
  requiredEnv("AGENT_ED25519_PUBLIC_PEM");
  console.log("✓ Ed25519 signing keys present");

  // Step 4: Docker availability (required for container isolation and Postgres)
  console.log("\nChecking Docker...");
  await checkDockerAvailable();
  console.log("✓ Docker daemon running");

  // Step 5: Database availability (essential for live verification)
  const databaseUrl = requiredEnv("DATABASE_URL");
  console.log("\nChecking Postgres...");
  await checkPostgresAvailable(databaseUrl);
  console.log("✓ Postgres is ready");

  // Import the repo after confirming DB is available
  const codexRunRepo = await import("@alfred/db/repo/codex-run");

  console.log("\n=== Starting Live Verification ===\n");

  const repoRoot = process.cwd();
  const dockerImage = process.env.ORCH_DOCKER_IMAGE;
  
  // Always use container isolation (production standard)
  const kind = "container" as const;
  console.log(`Workspace isolation: ${kind}`);

  const userId = process.env.CODEX_LIVE_USER_ID?.trim() || "codex-live-user";
  const sessionId = `codex-live-${randomUUID()}`;

  // Watchdog timeout: defaults to 5 minutes, configurable via env
  const timeoutMsRaw = process.env.RUN_CODEX_LIVE_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 5 * 60 * 1000;
  const watchdogMs = Number.isFinite(timeoutMs) ? Math.max(60_000, timeoutMs) : 5 * 60 * 1000;
  console.log(`Watchdog timeout: ${watchdogMs / 1000}s`);

  const watchdog = new AbortController();
  let watchdogTriggered = false;
  const watchdogTimer = setTimeout(() => {
    watchdogTriggered = true;
    console.error("\n⚠️  WATCHDOG TIMEOUT: Aborting Codex execution...");
    watchdog.abort();
  }, watchdogMs);

  // Issue a fresh token for each prompt to avoid replay protection
  async function issueToken(): Promise<string> {
    const token = await issueAccessToken(userId, ["droid.exec", "codex.read"], undefined, {
      ttlSec: 300,
      elevated: true,
      mfa: "passkey",
      roles: ["owner"],
    });
    return `Bearer ${token}`;
  }
  
  const authz1 = await issueToken();

  const ws = await createCodexLiveWorkspace({
    repoRoot,
    kind,
    dockerImage,
  });

  const artifactPath = path.join(ws.root, "codex_live_artifact.txt");

  try {
    // --- First prompt: Create artifact ---
    console.log("--- First Prompt: Create Artifact ---");

    const prompt1 = [
      "Create a file named codex_live_artifact.txt in the current directory.",
      'Write exactly: "hello" (no quotes).',
      'Then print exactly: "artifact_ok".',
    ].join("\n");

    const r1 = await runCodexLiveInWorkspace({
      workspace: ws,
      authz: authz1,
      sessionId,
      prompt: prompt1,
      auto: "low",
      timeoutSec: 300,
      signal: watchdog.signal,
    });

    const txt1 = await fs.readFile(artifactPath, "utf8");
    if (txt1.trim() !== "hello") {
      throw new Error("artifact_content_mismatch_initial");
    }
    console.log("✓ Artifact created with correct content");

    // DB assertions (essential)
    const run1 = await codexRunRepo.getLatestRunBySession({ userId, sessionId });
    if (!run1) {
      throw new Error("codex_run_not_persisted_initial");
    }
    console.log(`✓ Run persisted: ${run1.id}`);

    const events1 = await codexRunRepo.listEvents({ runId: run1.id, order: "asc", limit: 5000 });
    if (!events1 || events1.length === 0) {
      throw new Error("codex_events_missing_initial");
    }
    console.log(`✓ Events persisted: ${events1.length} events`);

    const search1 = await codexRunRepo.searchEvents({
      userId,
      query: "codex_turn_started",
      runId: run1.id,
      limit: 10,
      offset: 0,
    });
    if (search1.length === 0) {
      throw new Error("codex_events_search_failed_initial");
    }
    console.log("✓ Event search working");

    // --- Second prompt: Resume session and append to artifact ---
    console.log("\n--- Second Prompt: Resume Session ---");

    // Issue a fresh token for the second prompt (replay protection)
    const authz2 = await issueToken();

    const prompt2 = [
      "Append exactly: \" world\" to codex_live_artifact.txt (so it becomes hello world).",
      "Then print exactly: \"resume_ok\".",
    ].join("\n");

    const r2 = await runCodexLiveInWorkspace({
      workspace: ws,
      authz: authz2,
      sessionId,
      prompt: prompt2,
      auto: "low",
      timeoutSec: 300,
      signal: watchdog.signal,
    });

    const txt2 = await fs.readFile(artifactPath, "utf8");
    if (txt2.trim() !== "hello world") {
      throw new Error("artifact_content_mismatch_resume");
    }
    console.log("✓ Artifact updated to 'hello world'");

    // DB assertions for resume (essential)
    const run2 = await codexRunRepo.getLatestRunBySession({ userId, sessionId });
    if (!run2) {
      throw new Error("codex_run_not_persisted_resume");
    }
    console.log(`✓ Resume run persisted: ${run2.id}`);

    // Note: Codex creates new thread IDs for each API call, even when resuming.
    // The important relationships are: parent_run_id and resume_count.
    if (!run1.threadId || !run2.threadId) {
      throw new Error("codex_thread_id_missing");
    }
    console.log(`✓ Thread IDs present: run1=${run1.threadId}, run2=${run2.threadId}`);

    if (!run2.parentRunId || run2.parentRunId !== run1.id) {
      throw new Error("codex_parent_run_mismatch");
    }
    console.log(`✓ Parent run ID correct: ${run2.parentRunId}`);

    if (typeof run2.resumeCount !== "number" || run2.resumeCount < 1) {
      throw new Error("codex_resume_count_missing");
    }
    console.log(`✓ Resume count: ${run2.resumeCount}`);

    const events2 = await codexRunRepo.listEvents({ runId: run2.id, order: "asc", limit: 5000 });
    if (!events2 || events2.length === 0) {
      throw new Error("codex_events_missing_resume");
    }
    console.log(`✓ Resume events persisted: ${events2.length} events`);

    // --- Summary ---
    console.log("\n=== Verification Complete ===\n");

    const summary = {
      kind: ws.kind,
      workspaceRoot: ws.root,
      sessionId,
      run1: {
        id: run1.id,
        threadId: run1.threadId,
        events: events1.length,
      },
      run2: {
        id: run2.id,
        threadId: run2.threadId,
        parentRunId: run2.parentRunId,
        resumeCount: run2.resumeCount,
        events: events2.length,
      },
      outputs: {
        first: r1.result.slice(0, 500),
        second: r2.result.slice(0, 500),
      },
      chunks: { first: r1.chunks.length, second: r2.chunks.length },
    };

    console.log("✅ Codex live verification PASSED\n");
    console.log(redactSecrets(JSON.stringify(summary, null, 2)));
  } finally {
    clearTimeout(watchdogTimer);
    console.log("\nCleaning up workspace...");
    await cleanupCodexLiveWorkspace(ws);
    console.log("✓ Cleanup complete");

    if (watchdogTriggered) {
      console.error("\n❌ Verification failed due to watchdog timeout.");
      process.exit(1);
    }
  }

  // Explicitly exit to close DB connection pool
  process.exit(0);
}

if (import.meta.main) {
  main().catch((error) => {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ codex_live_verify_failed: ${msg}`);
    
    // Provide actionable hints for common failures
    if (msg.includes("docker_daemon_not_running")) {
      console.error("\nFix: Start Docker Desktop with 'open -a Docker' and wait for it to be ready.");
    } else if (msg.includes("postgres_not_ready")) {
      console.error("\nFix: Run 'bun run db:start' and wait for the container to be healthy.");
    } else if (msg.includes("codex_binary_not_found")) {
      console.error("\nFix: Build Codex with 'cd vendor/codex && cargo build --release'");
      console.error("     Or set CODEX_BIN=/path/to/codex");
    } else if (msg.includes("missing_env")) {
      console.error("\nFix: Ensure required environment variables are set in .env or the shell.");
    }
    
    process.exit(1);
  });
}
