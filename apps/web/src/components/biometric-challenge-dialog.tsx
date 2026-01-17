import type { Obligation, ObligationResumeEvent } from "@alfred/type";
import { Fingerprint, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { getTestMode } from "@/lib/env/isomorphic";
import { trpc } from "@/utils/trpc";

type ObligationDialogState = {
  runId?: string | null;
  obligations: Obligation[];
  resumeEvents: ObligationResumeEvent[];
};

export type ObligationChallengeDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  target?: "workflow" | "droid";
  mode?: "auto" | "external";
  state: ObligationDialogState | null;
};

const resumePreference: ObligationResumeEvent[] = [
  "bio-authz",
  "mfa-authz",
  "human-authz",
];

function pickResumeEvent(events: ObligationResumeEvent[]) {
  for (const option of resumePreference) {
    if (events.includes(option)) {
      return option;
    }
  }
  return "human-authz";
}

function formatMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) {
    return [];
  }
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

export function ObligationChallengeDialog({
  open,
  onClose,
  onSuccess,
  target = "workflow",
  mode = "auto",
  state,
}: ObligationChallengeDialogProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const workflowResume = trpc.workflow.resume.useMutation();
  const droidResume = trpc.droid.resume.useMutation();

  const runId = state?.runId ?? null;
  const obligations = state?.obligations ?? [];
  const resumeEvent = pickResumeEvent(state?.resumeEvents ?? []);
  const primary = obligations[0];
  const metadataRows = formatMetadata(primary?.metadata);

  const heading = useMemo(() => {
    if (resumeEvent === "human-authz") {
      return "Manual Confirmation Required";
    }
    return "Biometric / MFA Required";
  }, [resumeEvent]);

  const description = useMemo(() => {
    if (resumeEvent === "human-authz") {
      return "Confirm the high-risk action before resuming the workflow.";
    }
    return "Authenticate with your passkey to continue the workflow.";
  }, [resumeEvent]);

  const sendResume = async (
    event: ObligationResumeEvent,
    opts?: { authz?: string }
  ) => {
    if (!runId) {
      return;
    }
    if (target === "workflow") {
      await workflowResume.mutateAsync({
        runId,
        event,
        authz: opts?.authz ?? "session-ticket",
      });
    } else {
      await droidResume.mutateAsync({
        runId,
        authz: opts?.authz ?? "session-ticket",
      });
    }
  };

  useEffect(() => {
    if (!open || mode === "external" || !runId) {
      return;
    }
    if (resumeEvent === "human-authz") {
      return;
    }

    const triggerAuth = async () => {
      setIsAuthenticating(true);
      try {
        const session = await authClient.getSession();
        const email = session.data?.user?.email;
        if (!email) {
          toast.error("Session required for elevation");
          setIsAuthenticating(false);
          return;
        }
        const testMode = await getTestMode();
        if (!testMode) {
          const result = await authClient.signIn.passkey({
            email,
            autoFill: false,
          });
          if (!result.data) {
            throw new Error("passkey_failed");
          }
        }
        await sendResume(resumeEvent, { authz: "session-ticket" });
        toast.success("Authorization complete");
        onSuccess();
        onClose();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "obligation_resume_failed";
        if (
          message.includes("NotAllowedError") ||
          message.includes("cancel") ||
          message.includes("abort")
        ) {
          toast.info("Authentication dismissed");
          onClose();
          return;
        }
        toast.error(message);
      } finally {
        setIsAuthenticating(false);
      }
    };

    void triggerAuth();
  }, [open, mode, runId, resumeEvent, onClose, onSuccess]);

  const handleManualConfirmation = async () => {
    if (!runId) {
      return;
    }
    setIsAuthenticating(true);
    try {
      await sendResume("human-authz", { authz: "session-ticket" });
      toast.success("Workflow resumed");
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "resume_failed";
      toast.error(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="max-w-md rounded-3xl border border-white/10 bg-void-surface/90 shadow-none backdrop-blur-xl">
        <DialogHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-biolum/20 p-6">
              {resumeEvent === "human-authz" ? (
                <Shield className="h-12 w-12 text-biolum" strokeWidth={1.5} />
              ) : (
                <Fingerprint
                  className="h-12 w-12 text-biolum"
                  strokeWidth={1.5}
                />
              )}
            </div>
          </div>
          <DialogTitle className="text-center text-biolum tracking-tighter">
            {heading}
          </DialogTitle>
          <DialogDescription className="text-center text-biolum-dim">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {runId && (
            <div className="rounded-xl border border-white/10 bg-void-surface/40 p-4">
              <p className="text-biolum-dim text-sm">
                <span className="text-biolum-faint">Run ID:</span>
                <br />
                <span className="font-mono text-biolum">{runId}</span>
              </p>
            </div>
          )}

          {primary && (
            <div className="rounded-xl border border-white/10 bg-void-surface/40 p-4">
              <p className="text-biolum text-sm">
                {primary.reason || "High-risk action detected"}
              </p>
              <p className="mt-1 text-biolum-faint text-xs uppercase tracking-wide">
                Obligation: {primary.type}
              </p>
              {metadataRows.length > 0 && (
                <ul className="mt-3 space-y-1 text-biolum-dim text-xs">
                  {metadataRows.map(({ key, value }) => (
                    <li className="flex justify-between gap-2" key={key}>
                      <span className="text-biolum-faint">{key}</span>
                      <span className="text-right font-mono text-biolum">
                        {value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {resumeEvent === "human-authz" ? (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-full"
                disabled={isAuthenticating}
                onClick={handleManualConfirmation}
              >
                Confirm and Resume
              </Button>
              <Button
                className="w-full rounded-full"
                disabled={isAuthenticating}
                onClick={onClose}
                variant="outline"
              >
                Cancel
              </Button>
              <p className="text-center text-biolum-faint text-xs">
                Confirm you reviewed the requirement before resuming.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {isAuthenticating ? (
                <div className="py-4 text-center text-biolum-dim">
                  <p>Waiting for authentication...</p>
                  <p className="mt-2 text-biolum-faint text-xs">
                    Your device will prompt you for biometric or passkey
                    verification.
                  </p>
                </div>
              ) : null}
              <Button
                className="w-full rounded-full"
                disabled={isAuthenticating}
                onClick={onClose}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ObligationChallengeDialog as BiometricChallengeDialog };
