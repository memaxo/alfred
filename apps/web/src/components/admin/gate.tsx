import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function isBiometricError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  const maybe = error as {
    data?: { code?: string };
    message?: string;
    code?: string;
  };
  const code = maybe.data?.code ?? maybe.code;
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") {
    return true;
  }
  if (typeof maybe.message === "string") {
    return maybe.message.includes("biometric");
  }
  return false;
}

export function BiometricGate({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-yellow-400/30 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <ShieldAlert className="h-5 w-5" />
          Biometric verification required
        </CardTitle>
        <CardDescription>
          Re-authenticate with your passkey (Settings → Security) and retry to
          view Admin/Ops data.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={onRetry} variant="secondary">
          I have re-authenticated
        </Button>
      </CardFooter>
    </Card>
  );
}
