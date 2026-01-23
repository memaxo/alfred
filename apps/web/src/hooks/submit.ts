/**
 * Form Submission Hook
 *
 * Handles GenUI form submissions via tRPC.
 */

import { useCallback } from "react";
import { trpc } from "@/utils/trpc";

export function useSubmit(conversationId: string) {
  const submitMutation = trpc.genui.submit.useMutation();

  const submit = useCallback(
    async (
      formId: string,
      data: Record<string, unknown>,
      toolCallId?: string,
      schema?: unknown
    ) => {
      await submitMutation.mutateAsync({
        formId,
        conversationId,
        toolCallId,
        data,
        schema,
      });
    },
    [conversationId, submitMutation]
  );

  return {
    submit,
    isLoading: submitMutation.isPending,
    error: submitMutation.error,
  };
}
