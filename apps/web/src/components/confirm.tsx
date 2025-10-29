/**
 * Confirmation Component
 * 
 * Adapted from ai-sdk.dev/elements/components/confirmation
 * Handles user confirmations for sensitive actions
 */

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ConfirmProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  requireBio?: boolean;
  className?: string;
}

export function Confirm({
  title,
  description,
  onConfirm,
  onCancel,
  requireBio = false,
  className,
}: ConfirmProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {requireBio && (
          <CardDescription className="text-yellow-600">
            Biometric confirmation required
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {/* Additional content can go here */}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>
          {requireBio ? "Confirm with Passkey" : "Confirm"}
        </Button>
      </CardFooter>
    </Card>
  );
}

