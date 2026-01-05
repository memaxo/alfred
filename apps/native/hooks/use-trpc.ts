/**
 * Typed tRPC Hooks
 *
 * Provides properly typed wrappers around tRPC hooks to avoid `as any` casts.
 * These hooks ensure type safety while working around TypeScript inference limitations.
 */

import { trpc } from "@/utils/trpc";
import type {
  BookRouterInputs,
  NoteRouterInputs,
  NoteRouterOutputs,
  PreferenceRouterInputs,
  PrivacyRouterInputs,
  RemindRouterInputs,
  WorkflowRouterInputs,
} from "@/utils/trpc-types";

// Re-export types that components need
export type { NoteRouterOutputs };

// Note hooks
export function useNoteList(input: NoteRouterInputs["list"]) {
  return trpc.note.list.useQuery(input);
}

export function useNoteGet(
  input: NoteRouterInputs["get"],
  options?: { enabled?: boolean }
) {
  return trpc.note.get.useQuery(input, options);
}

export function useNoteCreate(
  options?: Parameters<typeof trpc.note.create.useMutation>[0]
) {
  return trpc.note.create.useMutation(options);
}

export function useNoteUpdate(
  options?: Parameters<typeof trpc.note.update.useMutation>[0]
) {
  return trpc.note.update.useMutation(options);
}

export function useNoteDelete(
  options?: Parameters<typeof trpc.note.delete.useMutation>[0]
) {
  return trpc.note.delete.useMutation(options);
}

// Reminder hooks
export function useReminderList(input: RemindRouterInputs["list"]) {
  return trpc.remind.list.useQuery(input);
}

export function useReminderCreate(
  options?: Parameters<typeof trpc.remind.create.useMutation>[0]
) {
  return trpc.remind.create.useMutation(options);
}

export function useReminderFire(
  options?: Parameters<typeof trpc.remind.fire.useMutation>[0]
) {
  return trpc.remind.fire.useMutation(options);
}

export function useReminderDelete(
  options?: Parameters<typeof trpc.remind.delete.useMutation>[0]
) {
  return trpc.remind.delete.useMutation(options);
}

// Timer hooks
export function useTimerActive() {
  return trpc.timer.active.useQuery();
}

export function useTimerCreate(
  options?: Parameters<typeof trpc.timer.create.useMutation>[0]
) {
  return trpc.timer.create.useMutation(options);
}

export function useTimerDone(
  options?: Parameters<typeof trpc.timer.done.useMutation>[0]
) {
  return trpc.timer.done.useMutation(options);
}

export function useTimerCancel(
  options?: Parameters<typeof trpc.timer.cancel.useMutation>[0]
) {
  return trpc.timer.cancel.useMutation(options);
}

// Bookmark hooks
export function useBookmarkList(input: BookRouterInputs["list"]) {
  return trpc.book.list.useQuery(input);
}

export function useBookmarkCreate(
  options?: Parameters<typeof trpc.book.create.useMutation>[0]
) {
  return trpc.book.create.useMutation(options);
}

export function useBookmarkDelete(
  options?: Parameters<typeof trpc.book.delete.useMutation>[0]
) {
  return trpc.book.delete.useMutation(options);
}

// Preference hooks
export function usePreferenceList(input: PreferenceRouterInputs["list"]) {
  return trpc.preference.list.useQuery(input);
}

export function usePreferenceSet(
  options?: Parameters<typeof trpc.preference.set.useMutation>[0]
) {
  return trpc.preference.set.useMutation(options);
}

export function usePreferenceDelete(
  options?: Parameters<typeof trpc.preference.delete.useMutation>[0]
) {
  return trpc.preference.delete.useMutation(options);
}

// Privacy hooks
export function usePrivacyFacts(input?: PrivacyRouterInputs["facts"]) {
  return trpc.privacy.facts.useQuery(input);
}

export function usePrivacyEvents(input?: PrivacyRouterInputs["events"]) {
  return trpc.privacy.events.useQuery(input);
}

export function usePrivacyDeleteFact(
  options?: Parameters<typeof trpc.privacy.deleteFact.useMutation>[0]
) {
  return trpc.privacy.deleteFact.useMutation(options);
}

export function usePrivacyPurge(
  options?: Parameters<typeof trpc.privacy.purge.useMutation>[0]
) {
  return trpc.privacy.purge.useMutation(options);
}

// Voice hooks
export function useVoiceListVoices() {
  return trpc.voice.listVoices.useQuery();
}

export function useVoicePreviewVoice() {
  return trpc.voice.previewVoice.useMutation();
}

// Workflow hooks
export function useWorkflowList(input: WorkflowRouterInputs["listRuns"]) {
  return trpc.workflow.listRuns.useQuery(input);
}

export function useWorkflowGet(input: WorkflowRouterInputs["get"]) {
  return trpc.workflow.get.useQuery(input);
}

export function useWorkflowResume(
  options?: Parameters<typeof trpc.workflow.resume.useMutation>[0]
) {
  return trpc.workflow.resume.useMutation(options);
}

// User hooks
export function useUserRegisterPushToken(
  options?: Parameters<typeof trpc.user.registerPushToken.useMutation>[0]
) {
  return trpc.user.registerPushToken.useMutation(options);
}
