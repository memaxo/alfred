/**
 * Privacy Controls Component
 *
 * Pure component for privacy operations (forget/export).
 * Single-word naming: PrivacyControls
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PrivacyControlsProps = {
  onForget?: () => void;
  onExport?: () => void;
  forgetDisabled?: boolean;
  exportDisabled?: boolean;
  className?: string;
};

export function PrivacyControls({
  onForget,
  onExport,
  forgetDisabled = false,
  exportDisabled = false,
  className,
}: PrivacyControlsProps) {
  const [confirmForget, setConfirmForget] = useState(false);

  const handleForgetClick = () => {
    if (!confirmForget) {
      setConfirmForget(true);
      return;
    }
    onForget?.();
    setConfirmForget(false);
  };

  const handleExportClick = () => {
    onExport?.();
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Privacy Controls</CardTitle>
        <CardDescription>
          Manage your data privacy and export your information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Data Export</h3>
          <p className="text-muted-foreground text-xs">
            Download a copy of your stored data in JSON format.
          </p>
          <Button
            disabled={exportDisabled}
            onClick={handleExportClick}
            variant="outline"
          >
            Export Data
          </Button>
        </div>
        <div className="space-y-2 border-t pt-4">
          <h3 className="font-medium text-sm">Data Deletion</h3>
          <p className="text-muted-foreground text-xs">
            Permanently delete your stored facts and events. This action cannot
            be undone.
          </p>
          {confirmForget ? (
            <div className="space-y-2">
              <p className="text-destructive text-sm">
                Are you sure? This will permanently delete your data.
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={forgetDisabled}
                  onClick={handleForgetClick}
                  variant="destructive"
                >
                  Confirm Delete
                </Button>
                <Button
                  onClick={() => setConfirmForget(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              disabled={forgetDisabled}
              onClick={handleForgetClick}
              variant="destructive"
            >
              Delete All Data
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

