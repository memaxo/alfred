/**
 * Level-4 Verification: Codex live-run + durable logs
 *
 * Gated by RUN_CODEX_LIVE=1.
 *
 * Verifies:
 * - real codex streaming execution completes
 * - artifacts are created inside an isolated workspace (worktree/container/poof)
 * - resume semantics work (same session/thread across 2 prompts)
 * - codex_runs + codex_events are persisted and searchable
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import { issueAccessToken } from "@alfred/auth/token";
import { redactSecrets } from "@alfred/agent/utils/redaction";
import {
  cleanupCodexLiveWorkspace,
  createCodexLiveWorkspace,
  runCodexLiveInWorkspace,
} from "@alfred/test-kit/codex/live";

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
  const codex = process.env.CODEX_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (!codex && openai) {
    process.env.CODEX_API_KEY = openai;
  }
  if (!process.env.CODEX_API_KEY?.trim() && !process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("missing_env:CODEX_API_KEY_or_OPENAI_API_KEY");
  }
}

function resolveWorkspaceKind(): "worktree" | "container" | "poof" {
  if (process.platform === "linux" && process.env.ORCH_USE_POOF === "1") {
    return "poof";
  }
  if (process.env.ORCH_USE_CONTAINERS === "1") {
    return "container";
  }
  return "worktree";
}

async function main() {
  if (process.env.RUN_CODEX_LIVE !== "1") {
    console.log("Skipping codex live verification (set RUN_CODEX_LIVE=1).");
    return;
  }

  const dbEnabled = (process.env.RUN_CODEX_LIVE_DB ?? "1") !== "0";
  if (dbEnabled) {
    requiredEnv("DATABASE_URL");
  } else {
    console.log("NOTE: RUN_CODEX_LIVE_DB=0 → skipping codex_runs/codex_events DB assertions.");
  }

  // Codex runner uses CODEX_API_KEY and/or OPENAI_API_KEY.
  ensureCodexApiKey();

  // Tool tokens must be signable/verifiable.
  requiredEnv("AGENT_ED25519_PRIVATE");
  requiredEnv("AGENT_ED25519_PUBLIC_PEM");

  const codexRunRepo = dbEnabled
    ? await import("@alfred/db/repo/codex-run")
    : null;

  const repoRoot = process.cwd();
  const kind = resolveWorkspaceKind();
  const dockerImage = process.env.ORCH_DOCKER_IMAGE;

  const userId = process.env.CODEX_LIVE_USER_ID?.trim() || "codex-live-user";
  const sessionId = `codex-live-${randomUUID()}`;

  const token = await issueAccessToken(userId, ["droid.exec", "codex.read"], undefined, {
    ttlSec: 300,
    elevated: true,
    mfa: "passkey",
    roles: ["owner"],
  });
  const authz = `Bearer ${token}`;

  const ws = await createCodexLiveWorkspace({
    repoRoot,
    kind,
    dockerImage,
    poofProfile: "standard",
    poofMode: "run",
  });

  const artifactPath = path.join(ws.root, "codex_live_artifact.txt");

  try {
    const prompt1 = [
      "Create a file named codex_live_artifact.txt in the current directory.",
      'Write exactly: "hello" (no quotes).',
      'Then print exactly: "artifact_ok".',
    ].join("\n");

    const r1 = await runCodexLiveInWorkspace({
      workspace: ws,
      authz,
      sessionId,
      prompt: prompt1,
      auto: "low",
      timeoutSec: 600,
    });

    const txt1 = await fs.readFile(artifactPath, "utf8");
    if (txt1.trim() !== "hello") {
      throw new Error("artifact_content_mismatch_initial");
    }

    const run1 = codexRunRepo
      ? await codexRunRepo.getLatestRunBySession({ userId, sessionId })
      : null;
    const events1 = run1
      ? await codexRunRepo?.listEvents({ runId: run1.id, order: "asc", limit: 5000 })
      : null;

    if (dbEnabled) {
      if (!codexRunRepo) {
        throw new Error("codex_db_repo_unavailable");
      }
      if (!run1) {
        throw new Error("codex_run_not_persisted_initial");
      }
      if (!events1 || events1.length === 0) {
        throw new Error("codex_events_missing_initial");
      }
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
    }

    const prompt2 = [
      "Append exactly: \" world\" to codex_live_artifact.txt (so it becomes hello world).",
      "Then print exactly: \"resume_ok\".",
    ].join("\n");

    const r2 = await runCodexLiveInWorkspace({
      workspace: ws,
      authz,
      sessionId,
      prompt: prompt2,
      auto: "low",
      timeoutSec: 600,
    });

    const txt2 = await fs.readFile(artifactPath, "utf8");
    if (txt2.trim() !== "hello world") {
      throw new Error("artifact_content_mismatch_resume");
    }

    const run2 = codexRunRepo
      ? await codexRunRepo.getLatestRunBySession({ userId, sessionId })
      : null;
    const events2 = run2
      ? await codexRunRepo?.listEvents({ runId: run2.id, order: "asc", limit: 5000 })
      : null;

    if (dbEnabled) {
      if (!codexRunRepo) {
        throw new Error("codex_db_repo_unavailable");
      }
      if (!run1 || !run2) {
        throw new Error("codex_run_not_persisted_resume");
      }
      if (!run1.threadId || !run2.threadId || run1.threadId !== run2.threadId) {
        throw new Error("codex_thread_resume_mismatch");
      }
      if (!run2.parentRunId || run2.parentRunId !== run1.id) {
        throw new Error("codex_parent_run_mismatch");
      }
      if (typeof run2.resumeCount !== "number" || run2.resumeCount < 1) {
        throw new Error("codex_resume_count_missing");
      }
      if (!events2 || events2.length === 0) {
        throw new Error("codex_events_missing_resume");
      }
    }

    const summary = {
      kind: ws.kind,
      workspaceRoot: ws.root,
      sessionId,
      dbEnabled,
      run1: run1
        ? { id: run1.id, threadId: (run1 as any).threadId, events: events1?.length ?? 0 }
        : null,
      run2: run2
        ? {
            id: run2.id,
            threadId: (run2 as any).threadId,
            parentRunId: (run2 as any).parentRunId,
            resumeCount: (run2 as any).resumeCount,
            events: events2?.length ?? 0,
          }
        : null,
      outputs: {
        first: r1.result.slice(0, 2000),
        second: r2.result.slice(0, 2000),
      },
      chunks: { first: r1.chunks.length, second: r2.chunks.length },
    };

    console.log("Codex live verification OK:");
    console.log(redactSecrets(JSON.stringify(summary, null, 2)));
  } finally {
    await cleanupCodexLiveWorkspace(ws);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("codex_live_verify_failed", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

