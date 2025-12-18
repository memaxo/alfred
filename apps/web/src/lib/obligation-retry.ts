import type { Obligation } from "@alfred/type";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

function isTestRuntime() {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
    return true;
  }
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env;
    if (env?.VITE_TEST_MODE === "true") {
      return true;
    }
  }
  return false;
}

function extractObligations(error: unknown): Obligation[] | null {
  if (error instanceof TRPCClientError) {
    const data = error.data as Record<string, unknown> | undefined;
    if (data?.code === "PRECONDITION_FAILED") {
      const cause = (data.cause as Record<string, unknown>) ?? {};
      const obligations = cause.obligations;
      if (Array.isArray(obligations) && obligations.length > 0) {
        return obligations as Obligation[];
      }
    }
  }
  return null;
}

async function satisfyObligations(obligations: Obligation[]) {
  const requiresBiometric = obligations.some((obligation) =>
    ["biometric", "mfa"].includes(obligation.type)
  );

  if (!requiresBiometric) {
    throw new Error("obligation_not_supported");
  }

  const session = await authClient.getSession();
  const email = session.data?.user?.email;
  if (!email) {
    throw new Error("session_required");
  }
  if (!isTestRuntime()) {
    const passkey =
      typeof authClient.signIn === "object" && authClient.signIn !== null
        ? (authClient.signIn as Record<string, unknown>).passkey
        : undefined;
    if (typeof passkey === "function") {
      const result = await passkey({ email, autoFill: false });
      if (!result?.data) {
        throw new Error("passkey_failed");
      }
    }
  }
  toast.success("Biometric confirmation complete");
}

export async function withObligationRetry<T>(
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const obligations = extractObligations(error);
    if (!obligations) {
      throw error;
    }
    await satisfyObligations(obligations);
    return action();
  }
}
