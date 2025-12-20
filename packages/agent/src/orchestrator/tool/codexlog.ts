import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";
import { redactEventData, redactSecrets } from "../../utils/redaction.js";

import * as codexRunRepo from "@alfred/db/repo/codex-run";

const listInputSchema = z.object({
  action: z.literal("list").describe("List Codex runs for the current user."),
  authz: z.string().optional().describe("Tool token for policy enforcement."),
  status: z
    .enum(["running", "completed", "failed", "cancelled"])
    .optional()
    .describe("Filter by run status."),
  sessionId: z.string().min(1).max(255).optional().describe("Filter by session id."),
  threadId: z.string().min(1).max(255).optional().describe("Filter by Codex thread id."),
  environmentKind: z
    .enum(["host", "worktree", "container", "poof"])
    .optional()
    .describe("Filter by isolation environment kind."),
  startedAfter: z
    .string()
    .datetime()
    .optional()
    .describe("ISO datetime filter (inclusive lower bound)."),
  startedBefore: z
    .string()
    .datetime()
    .optional()
    .describe("ISO datetime filter (inclusive upper bound)."),
  limit: z.number().int().min(1).max(200).optional().describe("Max rows to return."),
  offset: z.number().int().min(0).max(10_000).optional().describe("Offset for paging."),
});

const getInputSchema = z.object({
  action: z.literal("get").describe("Fetch a Codex run by id (owner-only)."),
  authz: z.string().optional().describe("Tool token for policy enforcement."),
  runId: z.string().uuid().describe("Codex run id."),
});

const eventsInputSchema = z.object({
  action: z.literal("events").describe("Fetch persisted events for a run."),
  authz: z.string().optional().describe("Tool token for policy enforcement."),
  runId: z.string().uuid().describe("Codex run id."),
  afterSeq: z.number().int().min(0).optional().describe("Return events after this seq."),
  limit: z.number().int().min(1).max(5000).optional().describe("Max events to return."),
  order: z.enum(["asc", "desc"]).optional().describe("Sort order by seq."),
});

const searchInputSchema = z.object({
  action: z.literal("search").describe("Full-text search across Codex events."),
  authz: z.string().optional().describe("Tool token for policy enforcement."),
  query: z.string().min(1).max(2000).describe("Search query."),
  runId: z.string().uuid().optional().describe("Optional run id filter."),
  eventTypes: z
    .array(z.string().min(1).max(100))
    .max(20)
    .optional()
    .describe("Optional event type filters."),
  limit: z.number().int().min(1).max(500).optional().describe("Max rows to return."),
  offset: z.number().int().min(0).max(10_000).optional().describe("Offset for paging."),
});

const artifactsInputSchema = z.object({
  action: z.literal("artifacts").describe("Fetch artifacts recorded for a run."),
  authz: z.string().optional().describe("Tool token for policy enforcement."),
  runId: z.string().uuid().describe("Codex run id."),
});

const reasoningInputSchema = z.object({
  action: z.literal("reasoning").describe("Extract reasoning traces from persisted events."),
  authz: z.string().optional().describe("Tool token for policy enforcement."),
  runId: z.string().uuid().describe("Codex run id."),
  limit: z.number().int().min(1).max(5000).optional().describe("Max events to scan."),
});

export const codexlogInputSchema = z.discriminatedUnion("action", [
  listInputSchema,
  getInputSchema,
  eventsInputSchema,
  searchInputSchema,
  artifactsInputSchema,
  reasoningInputSchema,
]);

export type CodexlogInput = z.infer<typeof codexlogInputSchema>;

const listOutputSchema = z.object({
  action: z.literal("list"),
  runs: z.array(z.unknown()),
});
const getOutputSchema = z.object({
  action: z.literal("get"),
  run: z.unknown(),
});
const eventsOutputSchema = z.object({
  action: z.literal("events"),
  events: z.array(z.unknown()),
});
const searchOutputSchema = z.object({
  action: z.literal("search"),
  events: z.array(z.unknown()),
});
const artifactsOutputSchema = z.object({
  action: z.literal("artifacts"),
  artifacts: z.array(z.unknown()),
});
const reasoningOutputSchema = z.object({
  action: z.literal("reasoning"),
  reasoning: z.array(
    z.object({
      seq: z.number().int(),
      text: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
});

export const codexlogOutputSchema = z.discriminatedUnion("action", [
  listOutputSchema,
  getOutputSchema,
  eventsOutputSchema,
  searchOutputSchema,
  artifactsOutputSchema,
  reasoningOutputSchema,
]);

function requireRunOwner(run: { userId?: unknown }, userId: string): void {
  if (run.userId !== userId) {
    throw new Error("codexlog_forbidden");
  }
}

function redactRun(run: unknown): unknown {
  return redactEventData(run);
}

function redactEvents<T>(events: T[]): unknown[] {
  return events.map((evt) => redactEventData(evt));
}

export const toolCodexlog = {
  name: "codexlog",
  description:
    "Query durable Codex run logs (runs, events, artifacts, reasoning) for debugging and observability.",
  inputSchema: codexlogInputSchema,
  outputSchema: codexlogOutputSchema,
  async execute({ input }: { input: CodexlogInput }) {
    const { claims } = await requireToolScopesAndPolicy(
      input.authz,
      ["codex.read"],
      {
        action: "codex.read",
        resource: {
          kind: "codex_run",
          id: "runId" in input ? input.runId : undefined,
        },
        context: {
          action: input.action,
        },
      }
    );

    const userId = claims.sub;

    switch (input.action) {
      case "list": {
        const startedAfter = input.startedAfter ? new Date(input.startedAfter) : undefined;
        const startedBefore = input.startedBefore ? new Date(input.startedBefore) : undefined;
        const runs = await codexRunRepo.listRuns({
          userId,
          status: input.status,
          sessionId: input.sessionId,
          threadId: input.threadId,
          environmentKind: input.environmentKind,
          startedAfter,
          startedBefore,
          limit: input.limit,
          offset: input.offset,
        });
        return { action: "list", runs: runs.map(redactRun) };
      }

      case "get": {
        const run = await codexRunRepo.getRun(input.runId);
        if (!run) {
          throw new Error("codexlog_not_found");
        }
        requireRunOwner(run, userId);
        return { action: "get", run: redactRun(run) };
      }

      case "events": {
        const run = await codexRunRepo.getRun(input.runId);
        if (!run) {
          throw new Error("codexlog_not_found");
        }
        requireRunOwner(run, userId);
        const events = await codexRunRepo.listEvents({
          runId: input.runId,
          afterSeq: input.afterSeq,
          limit: input.limit,
          order: input.order,
        });
        return { action: "events", events: redactEvents(events) };
      }

      case "search": {
        if (input.runId) {
          const run = await codexRunRepo.getRun(input.runId);
          if (!run) {
            throw new Error("codexlog_not_found");
          }
          requireRunOwner(run, userId);
        }
        const events = await codexRunRepo.searchEvents({
          userId,
          query: input.query,
          runId: input.runId,
          eventTypes: input.eventTypes,
          limit: input.limit,
          offset: input.offset,
        });
        return { action: "search", events: redactEvents(events) };
      }

      case "artifacts": {
        const run = await codexRunRepo.getRun(input.runId);
        if (!run) {
          throw new Error("codexlog_not_found");
        }
        requireRunOwner(run, userId);
        const raw = run.artifacts;
        const artifacts = Array.isArray(raw) ? raw : [];
        return { action: "artifacts", artifacts: artifacts.map((a) => redactEventData(a)) };
      }

      case "reasoning": {
        const run = await codexRunRepo.getRun(input.runId);
        if (!run) {
          throw new Error("codexlog_not_found");
        }
        requireRunOwner(run, userId);

        const events = await codexRunRepo.listEvents({
          runId: input.runId,
          order: "asc",
          limit: input.limit ?? 5000,
        });

        const reasoning: Array<{ seq: number; text: string; createdAt: string }> = [];
        for (const evt of events) {
          if (evt.eventType !== "alfred_event") {
            continue;
          }
          const eventData = evt.eventData;
          if (!eventData || typeof eventData !== "object") {
            continue;
          }
          const codexEvent = (eventData as { event?: unknown }).event;
          if (!codexEvent || typeof codexEvent !== "object") {
            continue;
          }
          if ((codexEvent as { type?: unknown }).type !== "thought") {
            continue;
          }
          const content =
            typeof (codexEvent as { content?: unknown }).content === "string"
              ? ((codexEvent as { content?: unknown }).content as string)
              : "";
          const safe = redactSecrets(content);
          if (!safe) {
            continue;
          }
          const createdAt = evt.createdAt.toISOString();
          reasoning.push({ seq: evt.seq, text: safe, createdAt });
        }

        return { action: "reasoning", reasoning };
      }
    }
  },
} as const;

