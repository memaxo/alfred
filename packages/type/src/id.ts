import { ulid } from "ulid";

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
 * Type guards and converters
 */
export const asRunId = (id: string) => id as RunId;
export const asSessionId = (id: string) => id as SessionId;
export const asEventId = (id: string) => id as EventId;
export const asTraceId = (id: string) => id as TraceId;
export const asUserId = (id: string) => id as UserId;
export const asProjectId = (id: string) => id as ProjectId;
