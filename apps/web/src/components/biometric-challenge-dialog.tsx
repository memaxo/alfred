import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
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
import { trpc } from "@/utils/trpc";

export type BiometricChallengeDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workflowId?: string;
};

export function BiometricChallengeDialog({
  open,
  onClose,
  onSuccess,
  workflowId,
}: BiometricChallengeDialogProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const resumeMutation = trpc.workflow.resume.useMutation();

  // Auto-trigger passkey flow when dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    const triggerPasskey = async () => {
      setIsAuthenticating(true);
      try {
        const session = await authClient.getSession();
        if (!session.data?.user?.email) {
          toast.error("Session required for biometric authentication");
          setIsAuthenticating(false);
          return;
        }

        // Auto-trigger passkey sign-in
        const result = await authClient.signIn.passkey({
          email: session.data.user.email,
          autoFill: false,
        });

        if (result.data) {
          // Passkey sign-in successful - biometric ticket is set automatically via Better Auth hook
          // Now resume the workflow with bio-authz event
          if (workflowId) {
            try {
              await resumeMutation.mutateAsync({
                runId: workflowId,
                event: "bio-authz",
                authz: "session-ticket", // Server validates requireRecentBiometric
              });
              toast.success("Biometric authentication successful");
              onSuccess();
              onClose();
            } catch (resumeError) {
              const message =
                resumeError instanceof Error
                  ? resumeError.message
                  : "workflow_resume_failed";
              toast.error(message);
            }
          } else {
            toast.success("Biometric authentication successful");
            onSuccess();
            onClose();
          }
        }
      } catch (error) {
        // User cancellation is not an error - just close dialog
        const message =
          error instanceof Error ? error.message : "biometric_auth_failed";

        // Check if it's a user cancellation (WebAuthn user cancellation)
        if (
          message.includes("NotAllowedError") ||
          message.includes("cancelled") ||
          message.includes("abort")
        ) {
          // User cancelled - don't show error, just close
          onClose();
          return;
        }

        toast.error(message);
      } finally {
        setIsAuthenticating(false);
      }
    };

    void triggerPasskey();
  }, [open, workflowId, onSuccess, onClose, resumeMutation]);

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="max-w-md rounded-3xl border border-white/10 bg-void-surface/90 shadow-none backdrop-blur-xl">
        <DialogHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-biolum/20 p-6">
              <Fingerprint
                className="h-12 w-12 text-biolum"
                strokeWidth={1.5}
              />
            </div>
          </div>
          <DialogTitle className="text-center text-biolum tracking-tighter">
            Biometric Authentication Required
          </DialogTitle>
          <DialogDescription className="text-center text-biolum-dim">
            This workflow requires elevated permissions. Please authenticate
            with your passkey to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {workflowId && (
            <div className="rounded-xl border border-white/10 bg-void-surface/40 p-4">
              <p className="text-biolum-dim text-sm">
                <span className="text-biolum-faint">Workflow ID:</span>
                <br />
                <span className="font-mono text-biolum">{workflowId}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isAuthenticating ? (
              <div className="py-4 text-center text-biolum-dim">
                <p>Waiting for biometric authentication...</p>
                <p className="mt-2 text-biolum-faint text-xs">
                  Your device will prompt you for biometric authentication.
                </p>
              </div>
            ) : null}
            <Button
              className="w-full rounded-full"
              disabled={isAuthenticating}
              onClick={handleCancel}
              variant="outline"
            >
              Cancel
            </Button>
          </div>

          <p className="text-center text-biolum-faint text-xs">
            Your device will prompt you for biometric authentication (Face ID,
            Touch ID, or Windows Hello).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
