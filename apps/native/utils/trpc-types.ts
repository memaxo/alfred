/**
 * tRPC Type Utilities
 *
 * Provides type-safe access to router inputs and outputs.
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { TRPCAppRouter } from "./trpc";

type RouterInputs = inferRouterInputs<TRPCAppRouter>;
type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;

// Note router types
export type NoteRouterInputs = RouterInputs["note"];
export type NoteRouterOutputs = RouterOutputs["note"];

// Reminder router types
export type RemindRouterInputs = RouterInputs["remind"];
export type RemindRouterOutputs = RouterOutputs["remind"];

// Timer router types
export type TimerRouterInputs = RouterInputs["timer"];
export type TimerRouterOutputs = RouterOutputs["timer"];

// Bookmark router types
export type BookRouterInputs = RouterInputs["book"];
export type BookRouterOutputs = RouterOutputs["book"];

// Preference router types
export type PreferenceRouterInputs = RouterInputs["preference"];
export type PreferenceRouterOutputs = RouterOutputs["preference"];

// Privacy router types
export type PrivacyRouterInputs = RouterInputs["privacy"];
export type PrivacyRouterOutputs = RouterOutputs["privacy"];

// Workflow router types
export type WorkflowRouterInputs = RouterInputs["workflow"];
export type WorkflowRouterOutputs = RouterOutputs["workflow"];

// User router types
export type UserRouterInputs = RouterInputs["user"];
export type UserRouterOutputs = RouterOutputs["user"];
