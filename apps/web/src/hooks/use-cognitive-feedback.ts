import { useCallback, useMemo, useState } from "react";

export type FeedbackSurface = "chat" | "mindscape" | "voice";

export interface CognitiveFeedbackInput {
  streamId: string;
  expected: string;
  actual: string;
  surface?: FeedbackSurface;
}

export type CognitiveFeedbackStatus = "idle" | "pending" | "success" | "error";

const encodeInput = (payload: CognitiveFeedbackInput) =>
  encodeURIComponent(JSON.stringify({ 0: { json: payload } }));

export function useCognitiveFeedback() {
  const [status, setStatus] = useState<CognitiveFeedbackStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async (input: CognitiveFeedbackInput) => {
    setStatus("pending");
    setError(null);

    try {
      const response = await fetch(
        `/api/trpc/cognitive.feedback?input=${encodeInput({
          ...input,
          surface: input.surface ?? "chat",
        })}`,
        {
          body: "[]",
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`feedback_request_failed_${response.status}`);
      }

      const body: unknown = await response.json();
      const first = Array.isArray(body) ? body[0] : null;
      const result =
        first && typeof first === "object"
          ? (first as Record<string, unknown>).result
          : null;
      const data =
        result && typeof result === "object"
          ? (result as Record<string, unknown>).data
          : null;

      if (!data) {
        throw new Error("feedback_response_invalid");
      }

      setStatus("success");
      return data;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("feedback_request_failed");
      setStatus("error");
      setError(err);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return useMemo(
    () => ({
      submit,
      status,
      error,
      reset,
    }),
    [error, reset, status, submit]
  );
}
