import { logger } from "@alfred/logger";
import type { PipelineEvent, PipelineObserver } from "@alfred/pipeline";
import {
  fromSerializable,
  type SerializableValue,
} from "@alfred/pipeline/snapshot";
import {
  type WorkflowCompilation,
  workflowCompilationSchema,
  workflowCompilationVersion,
} from "@alfred/type/compilation";

type CompilationObserverOptions = {
  runId: string;
  requirement: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function decodeContextValue(value: SerializableValue): unknown {
  try {
    return fromSerializable(value);
  } catch {
    return value;
  }
}

function toAgentList(executeOutput: unknown): WorkflowCompilation["agents"] {
  const rec = coerceRecord(executeOutput);
  const outcomesRaw = rec.outcomes;

  const outcomes = (() => {
    if (outcomesRaw instanceof Map) {
      return Array.from(outcomesRaw.values());
    }
    if (isRecord(outcomesRaw) && Array.isArray(outcomesRaw.entries)) {
      // Extremely defensive: allow a Map-like encoding that didn't get decoded.
      return outcomesRaw.entries.map((entry) =>
        Array.isArray(entry) ? entry[1] : null
      );
    }
    return [];
  })().filter(Boolean);

  return outcomes
    .map((outcome) => {
      const o = coerceRecord(outcome);
      return {
        agentId: typeof o.agentId === "string" ? o.agentId : "unknown",
        phaseId: typeof o.phaseId === "string" ? o.phaseId : undefined,
        role: typeof o.role === "string" ? o.role : undefined,
        status: typeof o.status === "string" ? o.status : "unknown",
        stuck: typeof o.stuck === "boolean" ? o.stuck : undefined,
        durationSeconds:
          typeof o.durationSeconds === "number" ? o.durationSeconds : undefined,
        escalation: typeof o.escalation === "string" ? o.escalation : undefined,
        result: (() => {
          const r = coerceRecord(o.result);
          if (Object.keys(r).length === 0) {
            return;
          }
          return {
            summary: typeof r.summary === "string" ? r.summary : undefined,
            artifacts: Array.isArray(r.artifacts)
              ? r.artifacts.filter((v) => typeof v === "string")
              : [],
            changes: Array.isArray(r.changes)
              ? r.changes.filter((v) => typeof v === "string")
              : [],
            notes: Array.isArray(r.notes)
              ? r.notes.filter((v) => typeof v === "string")
              : [],
            branch: typeof r.branch === "string" ? r.branch : undefined,
          };
        })(),
      } satisfies WorkflowCompilation["agents"][number];
    })
    .filter((a) => a.agentId.length > 0);
}

function toFileChanges(
  executeOutput: unknown
): WorkflowCompilation["fileChanges"] {
  const rec = coerceRecord(executeOutput);
  const raw = rec.fileChanges;
  const changes = Array.isArray(raw) ? raw : [];

  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const entry of changes) {
    const e = coerceRecord(entry);
    const action = typeof e.action === "string" ? e.action : "";
    const path = typeof e.path === "string" ? e.path : "";
    if (!path) {
      continue;
    }
    if (action === "create") {
      created.push(path);
    } else if (action === "modify") {
      modified.push(path);
    } else if (action === "delete") {
      deleted.push(path);
    }
  }

  return { created, modified, deleted };
}

function toSummaryText(summarizeOutput: unknown): string | undefined {
  const rec = coerceRecord(summarizeOutput);
  const summary = rec.summary;
  return typeof summary === "string" && summary.trim().length > 0
    ? summary.trim()
    : undefined;
}

export class CompilationObserver implements PipelineObserver {
  private readonly opts: CompilationObserverOptions;
  private executeOutput: unknown;
  private summarizeOutput: unknown;
  private persistPromise: Promise<void> | null = null;

  constructor(options: CompilationObserverOptions) {
    this.opts = options;
  }

  onEvent(event: PipelineEvent): void {
    if (event.type === "pipeline:complete") {
      void this.persistCompleted(event);
      return;
    }

    if (event.type === "pipeline:failed") {
      void this.persistFailed(event);
      return;
    }

    if (event.type === "context:set") {
      const decoded = decodeContextValue(event.value as SerializableValue);
      if (event.key === "executeOutput") {
        this.executeOutput = decoded;
      } else if (event.key === "summarizeOutput") {
        this.summarizeOutput = decoded;
      }
    }
  }

  private async persistCompleted(
    event: Extract<PipelineEvent, { type: "pipeline:complete" }>
  ): Promise<void> {
    const finishedAt = new Date(event.timestamp).toISOString();

    const summaryRec = coerceRecord(event.summary);
    const totalDurationMs =
      typeof summaryRec.totalDurationMs === "number"
        ? summaryRec.totalDurationMs
        : undefined;
    const agentsSpawned =
      typeof summaryRec.agentsSpawned === "number"
        ? summaryRec.agentsSpawned
        : undefined;
    const filesChanged =
      typeof summaryRec.filesChanged === "number"
        ? summaryRec.filesChanged
        : undefined;
    const learningInsights =
      typeof summaryRec.learningInsights === "number"
        ? summaryRec.learningInsights
        : undefined;
    const stages = Array.isArray(summaryRec.stages) ? summaryRec.stages : [];

    const compilation: WorkflowCompilation = {
      version: workflowCompilationVersion,
      runId: this.opts.runId,
      requirement: this.opts.requirement,
      status: "completed",
      finishedAt,
      totalDurationMs,
      agentsSpawned,
      filesChanged,
      learningInsights,
      stages: stages
        .map((s) => {
          const stage = coerceRecord(s);
          return {
            name: typeof stage.name === "string" ? stage.name : "unknown",
            durationMs:
              typeof stage.durationMs === "number"
                ? Math.max(0, Math.trunc(stage.durationMs))
                : 0,
            status: typeof stage.status === "string" ? stage.status : "success",
          };
        })
        .filter((s) => s.name.length > 0),
      summaryText: toSummaryText(this.summarizeOutput),
      fileChanges: toFileChanges(this.executeOutput),
      agents: toAgentList(this.executeOutput),
    };

    const parsed = workflowCompilationSchema.safeParse(compilation);
    if (!parsed.success) {
      logger.warn("workflow_compilation_invalid", {
        runId: this.opts.runId,
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    this.persistPromise ??= this.persistToDb(parsed.data).finally(() => {
      this.persistPromise = null;
    });
    await this.persistPromise;
  }

  private async persistFailed(
    event: Extract<PipelineEvent, { type: "pipeline:failed" }>
  ): Promise<void> {
    const finishedAt = new Date(event.timestamp).toISOString();

    const compilation: WorkflowCompilation = {
      version: workflowCompilationVersion,
      runId: this.opts.runId,
      requirement: this.opts.requirement,
      status: "failed",
      finishedAt,
      stages: [],
      summaryText: toSummaryText(this.summarizeOutput),
      fileChanges: toFileChanges(this.executeOutput),
      agents: toAgentList(this.executeOutput),
      lastStage: event.lastStage,
      error: event.error,
    };

    const parsed = workflowCompilationSchema.safeParse(compilation);
    if (!parsed.success) {
      logger.warn("workflow_compilation_invalid_failed", {
        runId: this.opts.runId,
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    this.persistPromise ??= this.persistToDb(parsed.data).finally(() => {
      this.persistPromise = null;
    });
    await this.persistPromise;
  }

  private async persistToDb(compilation: WorkflowCompilation): Promise<void> {
    try {
      const workflowRepo = await import("@alfred/db/repo/workflow");
      const run = await workflowRepo.getRun(this.opts.runId);
      const prev = coerceRecord(run?.stateData);
      const nextState = { ...prev, compilation };
      await workflowRepo.updateRun(this.opts.runId, { stateData: nextState });

      // Best-effort: surface the compilation in the event log for existing UIs.
      await workflowRepo
        .appendEvent({
          runId: this.opts.runId,
          eventType: "report",
          eventData: {
            kind: "workflow-compilation",
            version: compilation.version,
            status: compilation.status,
            summaryText: compilation.summaryText,
            fileChanges: compilation.fileChanges,
            agents: compilation.agents.map((a) => ({
              agentId: a.agentId,
              status: a.status,
            })),
          },
        })
        .catch(() => {});
    } catch (error) {
      logger.warn("workflow_compilation_persist_failed", {
        runId: this.opts.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
