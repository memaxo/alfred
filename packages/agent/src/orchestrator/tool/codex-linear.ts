import { logger } from "@alfred/metrics";
import { emitLinearActivity, type LinearActivityType } from "../linear";
import type { AlfredCodexEvent, CodexToolInput } from "./codex";

const MAX_ACTIVITIES_PER_MINUTE = 10;
const WINDOW_MS = 60_000;
const MAX_ACTIVITIES_PER_EXECUTION = 50;
const BATCH_WINDOW_MS = 2_000;

const timingConfig = {
  batchWindowMs: BATCH_WINDOW_MS,
  windowMs: WINDOW_MS,
};

type Histogram = {
  startTimer: (labels: { event_type: string }) => () => void;
};

type Counter = {
  inc: (labels: Record<string, string>) => void;
};

type MetricsBag = {
  histogram?: Histogram;
  activitiesEmitted?: Counter;
  activitiesDropped?: Counter;
  activityBatches?: Counter;
};

type CodexLinearMetricsConfig =
  | Histogram
  | {
      histogram?: Histogram;
      startTimer?: Histogram["startTimer"];
      activitiesEmitted?: Counter;
      activitiesDropped?: Counter;
      activityBatches?: Counter;
    };

let metricsBag: MetricsBag = {};

function isHistogramOnly(
  config: CodexLinearMetricsConfig
): config is Histogram {
  return (
    "startTimer" in config &&
    !("histogram" in config) &&
    !("activitiesEmitted" in config) &&
    !("activitiesDropped" in config) &&
    !("activityBatches" in config)
  );
}

export function configureCodexLinearMetrics(
  config: CodexLinearMetricsConfig
): void {
  if (isHistogramOnly(config)) {
    metricsBag = { histogram: config };
    return;
  }

  const histogram =
    ("histogram" in config && config.histogram) ??
    ("startTimer" in config && config.startTimer
      ? { startTimer: config.startTimer }
      : undefined);

  metricsBag = {
    histogram,
    activitiesEmitted:
      "activitiesEmitted" in config ? config.activitiesEmitted : undefined,
    activitiesDropped:
      "activitiesDropped" in config ? config.activitiesDropped : undefined,
    activityBatches:
      "activityBatches" in config ? config.activityBatches : undefined,
  };
}

export function injectLinearContext(
  prompt: string,
  context: CodexToolInput["context"]
): string {
  if (!context?.linearIssueId) {
    return prompt;
  }

  const issueId = context.linearIssueId;
  const issueUrl = `https://linear.app/issue/${issueId}`;

  return `[Context: Linear Issue ${issueId}]
You are working on Linear issue ${issueId}.
Issue URL: ${issueUrl}

${prompt}`;
}

type PendingEvent = {
  eventType: AlfredCodexEvent["type"];
  linearType: LinearActivityType;
  title?: string;
  body?: string;
  ephemeral?: boolean;
  raw: AlfredCodexEvent;
};

type RateLimitReason = "window" | "total";

type RateLimitedAggregate = {
  total: number;
  types: Record<string, number>;
  reasons: Record<RateLimitReason, number>;
  since: number;
  lastAt: number;
};

type SessionLimiterState = {
  activityCount: number;
  windowStart: number;
  totalEmitted: number;
  pending: PendingEvent[];
  context: {
    sessionId: string;
    space: string;
    authz: string;
  };
  flushPromise?: Promise<void>;
  batchTimer?: ReturnType<typeof setTimeout>;
  rateLimitTimer?: ReturnType<typeof setTimeout>;
  rateLimited?: RateLimitedAggregate;
  exhausted?: boolean;
};

const sessionStates = new Map<string, SessionLimiterState>();

type FinalActivityDraft = {
  eventTypeLabel: string;
  linearType: LinearActivityType;
  title?: string;
  body?: string;
  ephemeral?: boolean;
  mode: "single" | "batch" | "rate_limit";
  count: number;
};

export async function mapCodexEventToLinearActivity(
  event: AlfredCodexEvent,
  context: NonNullable<CodexToolInput["context"]>
): Promise<void> {
  const { linearSessionId, linearSpace, linearAuthz } = context;

  if (!(linearSessionId && linearSpace && linearAuthz)) {
    return;
  }

  const pending = convertEventToPending(event);
  if (!pending) {
    return;
  }

  const state = getSessionState(linearSessionId, linearSpace, linearAuthz);
  state.pending.push(pending);
  scheduleBatchFlush(linearSessionId, state);
}

function getSessionState(
  sessionId: string,
  space: string,
  authz: string
): SessionLimiterState {
  const existing = sessionStates.get(sessionId);
  if (existing) {
    if (
      existing.context.space !== space ||
      existing.context.authz !== authz
    ) {
      existing.context = { sessionId, space, authz };
    }
    return existing;
  }

  const now = Date.now();
  const created: SessionLimiterState = {
    activityCount: 0,
    windowStart: now,
    totalEmitted: 0,
    pending: [],
    context: { sessionId, space, authz },
  };
  sessionStates.set(sessionId, created);
  return created;
}

function scheduleBatchFlush(
  sessionId: string,
  state: SessionLimiterState
): void {
  if (state.batchTimer) {
    return;
  }
  state.batchTimer = setTimeout(() => {
    state.batchTimer = undefined;
    void queueFlush(sessionId);
  }, timingConfig.batchWindowMs);
}

function queueFlush(sessionId: string): Promise<void> {
  const state = sessionStates.get(sessionId);
  if (!state) {
    return Promise.resolve();
  }
  state.flushPromise = (state.flushPromise ?? Promise.resolve()).then(() =>
    flushPendingNow(sessionId)
  );
  return state.flushPromise;
}

async function flushPendingNow(sessionId: string): Promise<void> {
  const state = sessionStates.get(sessionId);
  if (!state) {
    return;
  }

  if (!state.pending.length) {
    await flushRateLimitedSummary(sessionId, state);
    cleanupState(sessionId, state);
    return;
  }

  const pending = state.pending.splice(0, state.pending.length);
  const groups = buildGroups(pending);

  for (const group of groups) {
    const draft = buildActivityFromGroup(group);
    const result = await tryEmitActivity(sessionId, state, draft);
    if (!result.emitted) {
      if (result.reason) {
        handleRateLimited(sessionId, state, group, result.reason);
      }
      continue;
    }

    metricsBag.activityBatches?.inc({
      status: draft.mode === "batch" ? "batched" : "single",
    });
    logger.info?.("linear_activity_batch_emit", {
      sessionId,
      event_type: draft.eventTypeLabel,
      count: draft.count,
      mode: draft.mode,
    });
  }

  cleanupState(sessionId, state);
}

type EventGroup = {
  eventType: AlfredCodexEvent["type"];
  events: PendingEvent[];
};

function buildGroups(queue: PendingEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const event of queue) {
    const last = groups[groups.length - 1];
    if (last && last.eventType === event.eventType) {
      last.events.push(event);
    } else {
      groups.push({ eventType: event.eventType, events: [event] });
    }
  }
  return groups;
}

function buildActivityFromGroup(group: EventGroup): FinalActivityDraft {
  const [first] = group.events;
  if (group.events.length === 1) {
    return {
      eventTypeLabel: group.eventType,
      linearType: first.linearType,
      title: first.title,
      body: first.body,
      ephemeral: first.ephemeral,
      mode: "single",
      count: 1,
    };
  }

  return {
    eventTypeLabel: group.eventType,
    linearType: first.linearType,
    title: `${group.events.length} ${group.eventType} events`,
    body: buildSummaryBody(group.eventType, group.events),
    ephemeral: true,
    mode: "batch",
    count: group.events.length,
  };
}

function buildSummaryBody(
  eventType: AlfredCodexEvent["type"],
  events: PendingEvent[]
): string {
  switch (eventType) {
    case "thought": {
      const last = events[events.length - 1].raw as Extract<
        AlfredCodexEvent,
        { type: "thought" }
      >;
      return `${events.length} thoughts captured in the last ${timingConfig.batchWindowMs / 1000}s.\nLatest: ${truncate(last.content)}`;
    }
    case "command": {
      const statusCounts = events.reduce<Record<string, number>>(
        (acc, item) => {
          const commandEvent = item.raw as Extract<
            AlfredCodexEvent,
            { type: "command" }
          >;
          acc[commandEvent.status] = (acc[commandEvent.status] ?? 0) + 1;
          return acc;
        },
        {}
      );
      const commands = Array.from(
        new Set(
          events.map((item) => {
            const commandEvent = item.raw as Extract<
              AlfredCodexEvent,
              { type: "command" }
            >;
            return commandEvent.command;
          })
        )
      );
      return `Commands: ${commands.slice(0, 3).join(", ")}${
        commands.length > 3 ? "…" : ""
      }\nStatuses: ${Object.entries(statusCounts)
        .map(([status, count]) => `${status}: ${count}`)
        .join(", ")}`;
    }
    case "artifact": {
      const paths = events.map((item) => {
        const artifactEvent = item.raw as Extract<
          AlfredCodexEvent,
          { type: "artifact" }
        >;
        return artifactEvent.path;
      });
      return `Artifacts: ${paths.slice(0, 5).join(", ")}${
        paths.length > 5 ? "…" : ""
      }`;
    }
    default:
      return `${events.length} ${eventType} events aggregated.`;
  }
}

async function tryEmitActivity(
  sessionId: string,
  state: SessionLimiterState,
  draft: FinalActivityDraft
): Promise<{ emitted: boolean; reason?: RateLimitReason }> {
  if (state.exhausted) {
    return { emitted: false, reason: "total" };
  }

  const now = Date.now();
  refreshWindow(state, now);

  if (state.totalEmitted >= MAX_ACTIVITIES_PER_EXECUTION) {
    state.exhausted = true;
    return { emitted: false, reason: "total" };
  }

  if (state.activityCount >= MAX_ACTIVITIES_PER_MINUTE) {
    return { emitted: false, reason: "window" };
  }

  state.activityCount += 1;
  state.totalEmitted += 1;

  const stopTimer = metricsBag.histogram?.startTimer({
    event_type: draft.eventTypeLabel,
  });

  try {
    await emitLinearActivity(draft.linearType, {
      sessionId: state.context.sessionId,
      space: state.context.space,
      authz: state.context.authz,
      title: draft.title,
      body: draft.body,
      ephemeral: draft.ephemeral,
    });
    metricsBag.activitiesEmitted?.inc({
      type: draft.eventTypeLabel,
      mode: draft.mode,
    });
    return { emitted: true };
  } catch (error) {
    logger.warn("linear_activity_failed_codex_event", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { emitted: false };
  } finally {
    stopTimer?.();
  }
}

function refreshWindow(state: SessionLimiterState, now: number): void {
  if (now - state.windowStart >= timingConfig.windowMs) {
    state.windowStart = now;
    state.activityCount = 0;
  }
}

function handleRateLimited(
  sessionId: string,
  state: SessionLimiterState,
  group: EventGroup,
  reason: RateLimitReason
): void {
  metricsBag.activityBatches?.inc({ status: "dropped" });
  for (const event of group.events) {
    metricsBag.activitiesDropped?.inc({ reason });
    logger.warn("linear_activity_rate_limited", {
      sessionId,
      reason,
      event_type: event.eventType,
    });
  }

  accumulateRateLimited(state, group, reason);

  if (reason === "window") {
    scheduleRateLimitedFlush(sessionId, state);
  } else {
    state.exhausted = true;
  }
}

function accumulateRateLimited(
  state: SessionLimiterState,
  group: EventGroup,
  reason: RateLimitReason
): void {
  const aggregate =
    state.rateLimited ?? {
      total: 0,
      types: {},
      reasons: { window: 0, total: 0 },
      since: Date.now(),
      lastAt: Date.now(),
    };
  aggregate.total += group.events.length;
  aggregate.types[group.eventType] =
    (aggregate.types[group.eventType] ?? 0) + group.events.length;
  aggregate.reasons[reason] =
    (aggregate.reasons[reason] ?? 0) + group.events.length;
  aggregate.lastAt = Date.now();
  state.rateLimited = aggregate;
}

function scheduleRateLimitedFlush(
  sessionId: string,
  state: SessionLimiterState
): void {
  const now = Date.now();
  const delay = Math.max(0, state.windowStart + timingConfig.windowMs - now) + 5;
  scheduleRateLimitRetry(sessionId, state, delay);
}

function scheduleRateLimitRetry(
  sessionId: string,
  state: SessionLimiterState,
  delay: number
): void {
  if (state.rateLimitTimer) {
    return;
  }
  state.rateLimitTimer = setTimeout(() => {
    state.rateLimitTimer = undefined;
    void flushRateLimitedSummary(sessionId, state);
  }, delay);
}

async function flushRateLimitedSummary(
  sessionId: string,
  providedState?: SessionLimiterState
): Promise<void> {
  const state = providedState ?? sessionStates.get(sessionId);
  if (!state?.rateLimited || state.exhausted) {
    return;
  }

  const summaryDraft = buildRateLimitedActivity(state.rateLimited);
  const result = await tryEmitActivity(sessionId, state, summaryDraft);

  if (!result.emitted) {
    if (result.reason === "window") {
      scheduleRateLimitedFlush(sessionId, state);
      return;
    }

    if (result.reason === "total") {
      state.exhausted = true;
      return;
    }

    scheduleRateLimitRetry(sessionId, state, timingConfig.batchWindowMs);
    return;
  }

  metricsBag.activityBatches?.inc({ status: "rate_limit_summary" });
  logger.info?.("linear_activity_rate_limit_summary", {
    sessionId,
    total: state.rateLimited.total,
  });
  state.rateLimited = undefined;
  cleanupState(sessionId, state);
}

function buildRateLimitedActivity(
  aggregate: RateLimitedAggregate
): FinalActivityDraft {
  const reasonSummary = Object.entries(aggregate.reasons)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(", ");
  const typeSummary = Object.entries(aggregate.types)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  return {
    eventTypeLabel: "summary",
    linearType: "action",
    title: "Codex activities rate limited",
    body: `Dropped ${aggregate.total} events (${reasonSummary}). Types: ${
      typeSummary || "n/a"
    }. Window: ${new Date(aggregate.since).toISOString()} → ${new Date(
      aggregate.lastAt
    ).toISOString()}`,
    ephemeral: true,
    mode: "rate_limit",
    count: aggregate.total,
  };
}

function cleanupState(sessionId: string, state: SessionLimiterState): void {
  if (
    state.exhausted &&
    !state.pending.length &&
    !state.rateLimited &&
    !state.batchTimer &&
    !state.rateLimitTimer
  ) {
    sessionStates.delete(sessionId);
  }
}

function convertEventToPending(
  event: AlfredCodexEvent
): PendingEvent | null {
  switch (event.type) {
    case "thought":
      return {
        eventType: event.type,
        linearType: "thought",
        body: event.content,
        raw: event,
      };
    case "command":
      if (event.status === "running") {
        return null;
      }
      return {
        eventType: event.type,
        linearType: "action",
        title: `Ran command: ${event.command}`,
        body: `Status: ${event.status}`,
        ephemeral: true,
        raw: event,
      };
    case "artifact":
      return {
        eventType: event.type,
        linearType: "action",
        title: `Created artifact: ${event.path}`,
        body: `Type: ${event.kind}`,
        ephemeral: true,
        raw: event,
      };
    case "output":
    default:
      return null;
  }
}

export function setCodexLinearTimingConfig(overrides?: {
  batchWindowMs?: number;
  windowMs?: number;
}): void {
  timingConfig.batchWindowMs = overrides?.batchWindowMs ?? BATCH_WINDOW_MS;
  timingConfig.windowMs = overrides?.windowMs ?? WINDOW_MS;
}

export function resetCodexLinearLimiter(): void {
  for (const state of sessionStates.values()) {
    if (state.batchTimer) {
      clearTimeout(state.batchTimer);
    }
    if (state.rateLimitTimer) {
      clearTimeout(state.rateLimitTimer);
    }
  }
  sessionStates.clear();
}

export async function flushCodexLinearBatches(): Promise<void> {
  await Promise.all(Array.from(sessionStates.keys()).map(queueFlush));
}

function truncate(value: string, max = 400): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}
