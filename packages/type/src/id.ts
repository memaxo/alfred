import { createHash, randomUUID } from "node:crypto";
import { ulid } from "ulid";

import { stableStringify } from "./serialize";

/**
 * Branded Types for ID safety.
 * These are strictly strings at runtime but prevent type confusion at compile time.
 */
export type RunId = string & { readonly __brand: "RunId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type EventId = string & { readonly __brand: "EventId" };
export type TraceId = string & { readonly __brand: "TraceId" };
export type UserId = string & { readonly __brand: "UserId" };
export type ProjectId = string & { readonly __brand: "ProjectId" };

export type IdPrefix = "run" | "sess" | "evt" | "trc" | "usr" | "prj";

/**
 * Generates a prefixed, time-sortable ULID.
 * Format: prefix_ULID (e.g., run_01AN4Z07BY79KA1307SR9X4MV3)
 */
export function makeId(prefix: "run"): RunId;
export function makeId(prefix: "sess"): SessionId;
export function makeId(prefix: "evt"): EventId;
export function makeId(prefix: "trc"): TraceId;
export function makeId(prefix: "usr"): UserId;
export function makeId(prefix: "prj"): ProjectId;
export function makeId(prefix: IdPrefix): string {
  return `${prefix}_${ulid()}`;
}

/**
 * Generate deterministic or random event IDs.
 *
 * When DETERMINISTIC_EVENT_IDS=1, generates content-addressable IDs using SHA256 hash.
 * Otherwise, generates random UUIDs.
 *
 * Used for event sourcing and debugging to enable deterministic replay.
 */
export function makeEventId(payload: {
  runId: string;
  type: string;
  data?: unknown;
}): string {
  const deterministic = (
    process.env.DETERMINISTIC_EVENT_IDS || ""
  ).toLowerCase();
  if (
    deterministic === "1" ||
    deterministic === "true" ||
    deterministic === "yes"
  ) {
    const s = `${payload.runId}|${payload.type}|${stableStringify(payload.data ?? null)}`;
    return createHash("sha256").update(s).digest("hex");
  }
  return randomUUID();
}

/**
 * Type guards and converters
 */
export const asRunId = (id: string) => id as RunId;
export const asSessionId = (id: string) => id as SessionId;
export const asEventId = (id: string) => id as EventId;
export const asTraceId = (id: string) => id as TraceId;
export const asUserId = (id: string) => id as UserId;
export const asProjectId = (id: string) => id as ProjectId;
