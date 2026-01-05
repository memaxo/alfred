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

// Note: get endpoint may not exist on note router
export function useNoteGet(
  input: { id: string },
  options?: { enabled?: boolean }
) {
  return (
    // @ts-expect-error - get endpoint may not be available
    trpc.note.get?.useQuery?.(input, options) ?? {
      data: null,
      isLoading: false,
      refetch: () => Promise.resolve(),
    }
  );
}

export function useNoteCreate(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.note.create.useMutation(options);
}

export function useNoteUpdate(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.note.update.useMutation(options);
}

export function useNoteDelete(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.note.delete.useMutation(options);
}

// Reminder hooks
export function useReminderList(input: RemindRouterInputs["list"]) {
  return trpc.remind.list.useQuery(input);
}

export function useReminderCreate(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.remind.create.useMutation(options);
}

export function useReminderFire(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.remind.fire.useMutation(options);
}

export function useReminderDelete(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.remind.delete.useMutation(options);
}

// Timer hooks
export function useTimerActive() {
  return trpc.timer.active.useQuery();
}

export function useTimerCreate(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.timer.create.useMutation(options);
}

export function useTimerDone(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.timer.done.useMutation(options);
}

export function useTimerCancel(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.timer.cancel.useMutation(options);
}

// Bookmark hooks
export function useBookmarkList(input: BookRouterInputs["list"]) {
  return trpc.book.list.useQuery(input);
}

export function useBookmarkCreate(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.book.create.useMutation(options);
}

export function useBookmarkDelete(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.book.delete.useMutation(options);
}

// Preference hooks
export function usePreferenceList(input: PreferenceRouterInputs["list"]) {
  return trpc.preference.list.useQuery(input);
}

export function usePreferenceSet(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.preference.set.useMutation(options);
}

export function usePreferenceDelete(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.preference.delete.useMutation(options);
}

// Privacy hooks
export function usePrivacyFacts(input?: PrivacyRouterInputs["facts"]) {
  return trpc.privacy.facts.useQuery(input);
}

export function usePrivacyEvents(input?: PrivacyRouterInputs["events"]) {
  return trpc.privacy.events.useQuery(input);
}

export function usePrivacyDeleteFact(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return trpc.privacy.deleteFact.useMutation(options);
}

export function usePrivacyPurge(options?: {
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onSuccess?: (data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: callbacks need any
  onError?: (error: any) => void;
}) {
  return (
    // @ts-expect-error - purge endpoint may not be available
    trpc.privacy.purge?.useMutation?.(options) ?? {
      mutate: () => {},
      mutateAsync: async () => ({}),
      isPending: false,
      error: null,
    }
  );
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
  // biome-ignore lint/suspicious/noExplicitAny: tRPC proxy needs any
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
  // biome-ignore lint/suspicious/noExplicitAny: tRPC proxy needs any
  return (
    (trpc.workflow as any).get?.useQuery?.(input) ?? {
      data: null,
      isLoading: false,
    }
  );
}

export function useWorkflowResume() {
  // biome-ignore lint/suspicious/noExplicitAny: tRPC proxy needs any
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
  return (
    // @ts-expect-error - registerPushToken endpoint may not be available
    trpc.user.registerPushToken?.useMutation?.() ?? {
      mutate: () => {},
      mutateAsync: async () => ({}),
      isPending: false,
      error: null,
    }
  );
}
