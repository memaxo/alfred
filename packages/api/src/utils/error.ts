import { TRPCError } from "@trpc/server";

/**
 * Convert unknown error to TRPCError.
 * Handles biometric_required special case for PRECONDITION_FAILED.
 */
export function toTRPCError(
  error: unknown,
  defaultMessage = "unknown_error"
): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : defaultMessage;
  if (message === "biometric_required") {
    return new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
    cause: error instanceof Error ? error : undefined,
  });
}
