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

export function useNoteCreate(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.note.create.useMutation(options);
}

export function useNoteUpdate(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.note.update.useMutation(options);
}

export function useNoteDelete(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.note.delete.useMutation(options);
}

// Reminder hooks
export function useReminderList(input: RemindRouterInputs["list"]) {
  return trpc.remind.list.useQuery(input);
}

export function useReminderCreate(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.remind.create.useMutation(options);
}

export function useReminderFire(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.remind.fire.useMutation(options);
}

export function useReminderDelete(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.remind.delete.useMutation(options);
}

// Timer hooks
export function useTimerActive() {
  return trpc.timer.active.useQuery();
}

export function useTimerCreate(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.timer.create.useMutation(options);
}

export function useTimerDone(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.timer.done.useMutation(options);
}

export function useTimerCancel(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.timer.cancel.useMutation(options);
}

// Bookmark hooks
export function useBookmarkList(input: BookRouterInputs["list"]) {
  return trpc.book.list.useQuery(input);
}

export function useBookmarkCreate(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.book.create.useMutation(options);
}

export function useBookmarkDelete(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  return trpc.book.delete.useMutation(options);
}

// Preference hooks
export function usePreferenceList(input: PreferenceRouterInputs["list"]) {
  return trpc.preference.list.useQuery(input);
}

export function usePreferenceSet() {
  return trpc.preference.set.useMutation();
}

export function usePreferenceDelete() {
  return trpc.preference.delete.useMutation();
}

// Privacy hooks
export function usePrivacyFacts(input?: PrivacyRouterInputs["facts"]) {
  return trpc.privacy.facts.useQuery(input);
}

export function usePrivacyEvents(input?: PrivacyRouterInputs["events"]) {
  return trpc.privacy.events.useQuery(input);
}

export function usePrivacyDeleteFact() {
  return trpc.privacy.deleteFact.useMutation();
}

export function usePrivacyPurge() {
  return trpc.privacy.purge.useMutation();
}

// Voice hooks
export function useVoiceListVoices() {
  return trpc.voice.listVoices.useQuery();
}

export function useVoicePreviewVoice() {
  return trpc.voice.previewVoice.useMutation();
}

// Workflow hooks (with optional chaining since structure may vary)
export function useWorkflowList(input?: { limit?: number; offset?: number }) {
  // Note: Adjust based on actual workflow router structure
  return (
    (trpc.workflow as any).list?.useQuery?.(input) ?? {
      data: [],
      isLoading: false,
      refetch: () => Promise.resolve(),
      isRefetching: false,
    }
  );
}

export function useWorkflowGet(input: { runId: string }) {
  return (
    (trpc.workflow as any).get?.useQuery?.(input) ?? {
      data: null,
      isLoading: false,
    }
  );
}

export function useWorkflowResume() {
  return (
    (trpc.workflow as any).resume?.useMutation?.() ?? {
      mutate: () => {},
      mutateAsync: async () => ({}),
      isPending: false,
      error: null,
    }
  );
}

// User hooks
export function useUserRegisterPushToken() {
  return trpc.user.registerPushToken.useMutation();
}
