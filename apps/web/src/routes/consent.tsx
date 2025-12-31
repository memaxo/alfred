import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const consentSearchSchema = z.object({
  consent_code: z.string().optional(),
  client_id: z.string().optional(),
  scope: z.string().optional(),
});

export const Route = createFileRoute("/consent")({
  validateSearch: consentSearchSchema,
  component: ConsentPage,
});

function ConsentPage() {
  const { consent_code, client_id, scope } = Route.useSearch();
  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);

  // Parse scopes for display
  const scopes = scope
    ? scope.split(" ").filter((s: string) => s.length > 0)
    : ["openid", "profile"];

  useEffect(() => {
    // Fetch client information if client_id is provided
    // For now, we'll use a placeholder. In production, this would fetch from Better Auth
    if (client_id) {
      setClientName(client_id); // Better Auth would provide client name
    }
  }, [client_id]);

  const handleConsent = async (accept: boolean) => {
    setStatus("processing");
    setError(null);
    try {
      // Better Auth OIDC consent endpoint
      // Type assertion needed until Better Auth types include oauth2.consent
      // @ts-expect-error - oauth2.consent method exists at runtime but not in types yet
      const { error } = await authClient.oauth2.consent({
        accept,
        consent_code: consent_code || undefined, // Optional if using cookie-based flow
      });

      if (error) {
        throw error;
      }

      if (accept) {
        setStatus("success");
      } else {
        // User denied - redirect or show message
        setStatus("error");
        setError("Authorization denied");
      }
    } catch (err: unknown) {
      setStatus("error");
      const message =
        err instanceof Error ? err.message : "Failed to process consent";
      setError(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-void p-4 text-biolum">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-void-surface/40 p-8 backdrop-blur-xl">
        <div className="space-y-2">
          <h1 className="font-bold text-2xl tracking-tighter">
            Authorize Application
          </h1>
          {clientName && (
            <p className="text-biolum-dim text-sm">
              <span className="font-semibold">{clientName}</span> is requesting
              access to your ALFRED account
            </p>
          )}
        </div>

        {status === "success" ? (
          <div className="space-y-4 py-4 text-center">
            <div className="text-5xl text-green-400">✓</div>
            <p className="font-bold text-green-400">Authorization Granted</p>
            <p className="text-biolum-dim text-sm">
              You can close this window now.
            </p>
          </div>
        ) : status === "error" && errorMessage ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-red-400 text-sm">{errorMessage}</p>
            <button
              className="w-full rounded-full border border-white/10 bg-void-surface/40 px-4 py-2 text-sm transition-opacity hover:opacity-80"
              onClick={() => {
                setStatus("idle");
                setError(null);
              }}
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="font-semibold text-sm">Requested Permissions:</p>
              <ul className="space-y-2 text-sm">
                {scopes.map((s: string) => (
                  <li
                    className="flex items-center gap-2 text-biolum-dim"
                    key={s}
                  >
                    <span className="text-green-400">✓</span>
                    <span>
                      {s === "openid"
                        ? "Verify your identity"
                        : s === "profile"
                          ? "Access your profile"
                          : s === "email"
                            ? "Access your email"
                            : s.startsWith("read:")
                              ? `Read ${s.replace("read:", "")} data`
                              : s.startsWith("write:")
                                ? `Modify ${s.replace("write:", "")} data`
                                : s.startsWith("admin:")
                                  ? `Admin access to ${s.replace("admin:", "")}`
                                  : s}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-full border border-white/10 bg-void-surface/40 px-4 py-3 font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                disabled={status === "processing"}
                onClick={() => handleConsent(false)}
              >
                Deny
              </button>
              <button
                className="flex-1 rounded-full bg-biolum px-4 py-3 font-bold text-void transition-opacity hover:bg-biolum/90 disabled:opacity-50"
                disabled={status === "processing"}
                onClick={() => handleConsent(true)}
              >
                {status === "processing" ? "Processing..." : "Authorize"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
