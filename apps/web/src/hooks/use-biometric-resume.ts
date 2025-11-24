import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export type ResumeTarget = "workflow" | "droid";

export type UseBiometricResumeArgs = {
  runId: string | null;
  target: ResumeTarget;
};

export function useBiometricResume({ runId, target }: UseBiometricResumeArgs) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const workflowResume = trpc.workflow.resume.useMutation();
  const droidResume = trpc.droid.resume.useMutation();

  const resumeMutation = useMemo(() => {
    return target === "workflow" ? workflowResume : droidResume;
  }, [target, workflowResume, droidResume]);

  const trigger = useCallback(async () => {
    if (!runId) {
      return;
    }
    setPendingRunId(runId);
    setIsOpen(true);
    try {
      const session = await authClient.getSession();
      const email = session.data?.user?.email;
      if (!email) {
        toast.error("Session required for biometric elevation");
        setIsOpen(false);
        return;
      }
      const result = await authClient.signIn.passkey({
        email,
        autoFill: false,
      });
      if (!result.data) {
        throw new Error("passkey_failed");
      }
      if (target === "workflow") {
        await workflowResume.mutateAsync({
          runId,
          event: "bio-authz",
          authz: "session-ticket",
        });
      } else {
        await droidResume.mutateAsync({
          runId,
          authz: "session-ticket",
        });
      }
      toast.success("Biometric elevation complete");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "biometric_resume_failed";
      if (
        message.includes("NotAllowedError") ||
        message.includes("cancel") ||
        message.includes("abort")
      ) {
        toast.info("Biometric prompt dismissed");
      } else {
        toast.error(message);
      }
    } finally {
      setIsOpen(false);
      setPendingRunId(null);
    }
  }, [runId, target, workflowResume, droidResume]);

  const close = useCallback(() => {
    setIsOpen(false);
    setPendingRunId(null);
  }, []);

  return {
    isOpen,
    pendingRunId,
    trigger,
    close,
  };
}
