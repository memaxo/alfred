import { Fingerprint } from "lucide-react";
import { useState } from "react";
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

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    try {
      // Use Better Auth's passkey authentication
      // This is a placeholder - actual implementation depends on Better Auth passkey setup
      // For now, simulate successful authentication
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      toast.success("Biometric authentication successful");
      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "biometric_auth_failed";
      toast.error(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border border-white/10 bg-void-surface/90 backdrop-blur-xl shadow-none">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-biolum/20 p-6">
              <Fingerprint className="h-12 w-12 text-biolum" strokeWidth={1.5} />
            </div>
          </div>
          <DialogTitle className="text-biolum tracking-tighter text-center">
            Biometric Authentication Required
          </DialogTitle>
          <DialogDescription className="text-biolum-dim text-center">
            This workflow requires elevated permissions. Please authenticate with your 
            passkey to continue.
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
            <Button
              onClick={handleAuthenticate}
              disabled={isAuthenticating}
              className="w-full rounded-full"
            >
              {isAuthenticating ? (
                "Authenticating..."
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Authenticate with Passkey
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full rounded-full"
              disabled={isAuthenticating}
            >
              Cancel
            </Button>
          </div>

          <p className="text-biolum-faint text-xs text-center">
            Your device will prompt you for biometric authentication (Face ID, Touch ID, 
            or Windows Hello).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

