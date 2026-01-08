"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UnsavedDialogProps = {
  isOpen: boolean;
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedDialog({
  isOpen,
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedDialogProps) {
  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            Do you want to save the changes you made to{" "}
            <span className="font-medium text-biolum">{fileName}</span>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button onClick={onDiscard} variant="ghost">
            Don't Save
          </Button>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
