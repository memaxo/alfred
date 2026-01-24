import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { RouteError } from "@/components/route-error";
import { processCallback } from "@/lib/auth/linear.fn";

export const Route = createFileRoute("/auth/callback/linear")({
  component: CallbackComponent,
  errorComponent: RouteError,
  validateSearch: z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  }),
});

function CallbackComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (search.error) {
      setStatus("error");
      setErrorMessage(search.error);
      setTimeout(() => {
        navigate({ to: "/" });
        toast.error("Failed to connect Linear");
      }, 2000);
      return;
    }

    const { code, state } = search;

    if (!(code && state)) {
      setStatus("error");
      setErrorMessage("missing_params");
      setTimeout(() => {
        navigate({ to: "/" });
        toast.error("Missing OAuth parameters");
      }, 2000);
      return;
    }

    // Process callback
    processCallback({ data: { code, state } })
      .then(() => {
        setStatus("success");
        setTimeout(() => {
          navigate({ to: "/" });
          toast.success("Linear connected successfully");
        }, 1000);
      })
      .catch((error) => {
        setStatus("error");
        const message =
          error instanceof Error ? error.message : "oauth_callback_failed";
        setErrorMessage(message);
        setTimeout(() => {
          navigate({ to: "/" });
          toast.error(message);
        }, 2000);
      });
  }, [search, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        {status === "processing" && (
          <p className="text-biolum">Connecting to Linear...</p>
        )}
        {status === "success" && (
          <p className="text-biolum">Linear connected successfully!</p>
        )}
        {status === "error" && (
          <div className="space-y-2">
            <p className="text-biolum-dim">Failed to connect Linear</p>
            {errorMessage && (
              <p className="text-biolum-faint text-sm">{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
