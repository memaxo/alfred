import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/elevate")({
  validateSearch: z.object({
    sessionId: z.string().optional(),
  }),
  component: ElevatePage,
});

function ElevatePage() {
  // sessionId available from search params if needed in future
  Route.useSearch();
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");
  const [errorMessage, setError] = useState<string | null>(null);

  const handleElevate = async () => {
    setStatus("verifying");
    setError(null);
    try {
      // Get session to get user email if not provided
      const { data: sessionData } = await authClient.getSession();
      const email = sessionData?.user?.email;

      if (!email) {
        throw new Error("User email not found. Please sign in again.");
      }

      // Re-authenticate with passkey to grant biometric ticket
      // The backend 'bio-ticket' plugin hook will handle granting the ticket
      const result = await authClient.signIn.passkey({
        email,
        autoFill: false,
      });

      if (result.error) {
        throw result.error;
      }

      setStatus("success");
    } catch (error: unknown) {
      setStatus("error");
      const message =
        error instanceof Error ? error.message : "Passkey verification failed";
      setError(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-void p-4 text-biolum">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-void-surface/40 p-8 text-center backdrop-blur-xl">
        <div className="space-y-2">
          <h1 className="font-bold text-3xl tracking-tighter">
            Biometric Verification
          </h1>
          <p className="text-biolum-dim">
            Verify your identity to proceed with elevated commands
          </p>
        </div>

        {status === "success" ? (
          <div className="space-y-4 py-4">
            <div className="text-5xl text-green-400">✓</div>
            <p className="font-bold text-green-400">Verification Successful!</p>
            <p className="text-biolum-dim text-sm">
              You can return to your terminal now.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full border-2 border-white/10 border-dashed p-12">
              <svg
                className="h-24 w-24 text-biolum-faint"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3m0 18a10.003 10.003 0 01-12-10V7a2 2 0 012-2h2m10 14a2 2 0 002-2V7a2 2 0 00-2-2h-2m-1 0V3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                />
              </svg>
            </div>

            {status === "error" && (
              <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            <button
              className="w-full rounded-full bg-biolum px-6 py-4 font-bold text-lg text-void transition-all hover:bg-biolum/90 active:scale-95 disabled:opacity-50"
              disabled={status === "verifying"}
              onClick={handleElevate}
            >
              {status === "verifying" ? "Verifying..." : "Verify with Passkey"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
