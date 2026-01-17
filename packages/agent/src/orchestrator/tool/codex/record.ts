import { logger } from "@alfred/logger";
import { redactEventData, redactSecrets } from "../../../utils/redaction.js";
import { truncateToBytes } from "./truncate.js";

type CodexRunRepo = {
  createRun: (args: {
    userId: string;
    projectId?: string | null;
    sessionId?: string | null;
    threadId?: string | null;
    parentRunId?: string | null;
    resumeCount?: number;
    status?: "running";
    auto?: string | null;
    model?: string | null;
    profile?: string | null;
    environmentKind?: string;
    workingDirectory?: string | null;
    workspaceRoot?: string | null;
    /** AgentFS database path for audit trail */
    agentfsDbPath?: string | null;
    /** AgentFS run identifier */
    agentfsRunId?: string | null;
    outputSchema?: unknown;
  }) => Promise<{ id: string }>;
  getLatestRunBySession: (args: {
    userId: string;
    sessionId: string;
  }) => Promise<{ id: string; resumeCount: number } | null>;
  appendEventsBatch: (args: {
    runId: string;
    events: Array<{
      seq: number;
      eventType: string;
      eventData?: unknown;
      text?: string | null;
      createdAt?: Date;
    }>;
  }) => Promise<{ inserted: number }>;
  finalizeRun: (
    runId: string,
    patch: Partial<{
      status: "completed" | "failed" | "cancelled";
      threadId: string | null;
      exitCode: number | null;
      errorCode: string | null;
      errorMessage: string | null;
      completedAt: Date | null;
      artifacts: unknown;
      resultText: string | null;
      structuredOutput: unknown;
      structuredOutputStatus: string | null;
    }>
  ) => Promise<unknown>;
};

type RecorderEvent = {
  seq: number;
  eventType: string;
  eventData: unknown;
  text: string | null;
  createdAt: Date;
};

export type CodexRunRecorderOptions = {
  userId: string | undefined;
  projectId?: string | undefined;
  sessionId: string | undefined;
  threadId: string | undefined;
  auto: string | undefined;
  model: string | undefined;
  profile: string | undefined;
  environmentKind: "agentfs";
  workingDirectory: string | undefined;
  workspaceRoot: string | undefined;
  /** AgentFS database path for audit trail */
  agentfsDbPath: string | undefined;
  /** AgentFS run identifier */
  agentfsRunId: string | undefined;
  outputSchema: unknown;
};

const MAX_EVENT_TEXT_BYTES = 16 * 1024;
const MAX_RESULT_TEXT_BYTES = 256 * 1024;

function capText(text: string, maxBytes: number): string {
  if (!text) {
    return "";
  }
  return truncateToBytes(text, maxBytes);
}

function safeText(text: string | undefined, maxBytes: number): string | null {
  if (!text) {
    return null;
  }
  const redacted = redactSecrets(text);
  const capped = capText(redacted, maxBytes);
  return capped.length > 0 ? capped : null;
}

async function loadRepo(): Promise<CodexRunRepo | null> {
  if (
    process.env.BUN_TEST === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.BUN_ENVIRONMENT === "test"
  ) {
    return null;
  }
  if (!process.env.DATABASE_URL) {
    return null;
  }
  try {
    const pkg = "@alfred/db/repo/codex-run";
    const mod = (await import(
      /* @vite-ignore */ pkg
    )) as unknown as CodexRunRepo;
    return mod;
  } catch (error) {
    logger.warn("codex_run_repo_unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export class CodexRunRecorder {
  static async start(
    options: CodexRunRecorderOptions
  ): Promise<CodexRunRecorder> {
    const repo = await loadRepo();
    if (!(repo && options.userId)) {
      return new CodexRunRecorder(null, null, null);
    }

    const sessionId = options.sessionId?.trim() || undefined;
    let parentRunId: string | null = null;
    let resumeCount = 0;
    if (sessionId) {
      try {
        const prior = await repo.getLatestRunBySession({
          userId: options.userId,
          sessionId,
        });
        if (prior) {
          parentRunId = prior.id;
          resumeCount = Math.max(0, (prior.resumeCount ?? 0) + 1);
        }
      } catch (error) {
        logger.warn("codex_run_chain_lookup_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const created = await repo
      .createRun({
        userId: options.userId,
        projectId: options.projectId ?? null,
        sessionId: sessionId ?? null,
        threadId: options.threadId ?? null,
        parentRunId,
        resumeCount,
        status: "running",
        auto: options.auto ?? null,
        model: options.model ?? null,
        profile: options.profile ?? null,
        environmentKind: options.environmentKind,
        workingDirectory: options.workingDirectory ?? null,
        workspaceRoot: options.workspaceRoot ?? null,
        agentfsDbPath: options.agentfsDbPath ?? null,
        agentfsRunId: options.agentfsRunId ?? null,
        outputSchema: options.outputSchema ?? null,
      })
      .catch((error) => {
        logger.warn("codex_run_create_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });

    const runId = created?.id ?? null;
    return new CodexRunRecorder(repo, runId, options.threadId ?? null);
  }

  private seq = 0;
  private readonly queue: RecorderEvent[] = [];
  private queuedBytes = 0;
  private flushing: Promise<void> | null = null;
  private flushScheduled = false;

  private constructor(
    private readonly repo: CodexRunRepo | null,
    readonly runId: string | null,
    private threadId: string | null
  ) {}

  setThreadId(threadId: string | undefined): void {
    if (!threadId) {
      return;
    }
    this.threadId = threadId;
  }

  recordThreadEvent(event: unknown): void {
    this.record("thread_event", event, null);
  }

  recordWriterChunk(payload: unknown): void {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const type = (payload as { type?: unknown }).type;
    if (typeof type !== "string") {
      return;
    }

    if (type === "stdout" || type === "stderr") {
      const text = (payload as { text?: unknown }).text;
      this.record(type, payload, typeof text === "string" ? text : null);
      return;
    }

    if (type === "notice") {
      const msg = (payload as { message?: unknown }).message;
      this.record("notice", payload, typeof msg === "string" ? msg : null);
      return;
    }

    if (type === "codex_event") {
      const event = (payload as { event?: unknown }).event;
      let text: string | null = null;
      if (event && typeof event === "object") {
        const evtType = (event as { type?: unknown }).type;
        if (evtType === "thought") {
          const content = (event as { content?: unknown }).content;
          text = typeof content === "string" ? content : null;
        } else if (evtType === "output") {
          const content = (event as { content?: unknown }).content;
          text = typeof content === "string" ? content : null;
        } else if (evtType === "artifact") {
          const path = (event as { path?: unknown }).path;
          text = typeof path === "string" ? path : null;
        } else if (evtType === "command") {
          const cmd = (event as { command?: unknown }).command;
          text = typeof cmd === "string" ? cmd : null;
        }
      }
      this.record("alfred_event", payload, text);
      return;
    }
  }

  record(eventType: string, eventData: unknown, text: string | null): void {
    if (!(this.repo && this.runId)) {
      return;
    }

    const now = new Date();
    const safeData = redactEventData(eventData);
    const safe = safeText(text ?? undefined, MAX_EVENT_TEXT_BYTES);

    this.seq += 1;
    const seq = this.seq;
    this.queue.push({
      seq,
      eventType,
      eventData: safeData,
      text: safe,
      createdAt: now,
    });

    this.queuedBytes +=
      (safe ? Buffer.byteLength(safe) : 0) + Buffer.byteLength(eventType);

    // Best-effort flush: keep durable logs close to real-time without stalling the stream.
    if (this.queue.length >= 200 || this.queuedBytes >= 1_000_000) {
      this.scheduleFlush();
    }
  }

  async flush(): Promise<void> {
    if (!(this.repo && this.runId)) {
      return;
    }

    if (this.queue.length === 0) {
      return this.flushing ?? undefined;
    }

    const batch = this.queue.splice(0, this.queue.length);
    this.queuedBytes = 0;

    const doFlush = async () => {
      try {
        await this.repo?.appendEventsBatch({
          runId: this.runId as string,
          events: batch.map((evt) => ({
            seq: evt.seq,
            eventType: evt.eventType,
            eventData: evt.eventData,
            text: evt.text,
            createdAt: evt.createdAt,
          })),
        });
      } catch (error) {
        logger.warn("codex_run_append_failed", {
          runId: this.runId ?? undefined,
          count: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    this.flushing = (this.flushing ?? Promise.resolve()).then(doFlush);
    await this.flushing;
  }

  scheduleFlush(): void {
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      void this.flush();
    });
  }

  async finalizeSuccess(args: {
    resultText: string;
    artifacts: unknown;
    structuredOutput: unknown;
    structuredOutputStatus: string | null;
  }): Promise<void> {
    if (!(this.repo && this.runId)) {
      return;
    }
    await this.flush().catch(() => {});
    const now = new Date();
    const resultText = safeText(args.resultText, MAX_RESULT_TEXT_BYTES);
    await this.repo
      .finalizeRun(this.runId, {
        status: "completed",
        threadId: this.threadId,
        exitCode: 0,
        errorCode: null,
        errorMessage: null,
        completedAt: now,
        artifacts: redactEventData(args.artifacts),
        resultText,
        structuredOutput: redactEventData(args.structuredOutput),
        structuredOutputStatus: args.structuredOutputStatus,
      })
      .catch((error) => {
        logger.warn("codex_run_finalize_failed", {
          runId: this.runId ?? undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  async finalizeError(args: {
    exitCode: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  }): Promise<void> {
    if (!(this.repo && this.runId)) {
      return;
    }
    await this.flush().catch(() => {});
    const now = new Date();
    const errorMessage = safeText(
      args.errorMessage ?? undefined,
      MAX_EVENT_TEXT_BYTES
    );
    await this.repo
      .finalizeRun(this.runId, {
        status: "failed",
        threadId: this.threadId,
        exitCode: args.exitCode,
        errorCode: args.errorCode,
        errorMessage,
        completedAt: now,
      })
      .catch((error) => {
        logger.warn("codex_run_finalize_failed", {
          runId: this.runId ?? undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}
