"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NewFileDialogProps = {
  isOpen: boolean;
  basePath: string;
  onClose: () => void;
  onCreate: (path: string) => void;
};

export function NewFileDialog({
  isOpen,
  basePath,
  onClose,
  onCreate,
}: NewFileDialogProps) {
  const [fileName, setFileName] = useState("");

  const handleCreate = () => {
    if (!fileName.trim()) {
      return;
    }
    const fullPath = basePath.endsWith("/")
      ? `${basePath}${fileName}`
      : `${basePath}/${fileName}`;
    onCreate(fullPath);
    setFileName("");
    onClose();
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setFileName("");
          onClose();
        }
      }}
      open={isOpen}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New File</DialogTitle>
          <DialogDescription>
            Create a new file in{" "}
            <span className="font-mono text-biolum-dim text-xs">
              {basePath}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <input
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreate();
              }
            }}
            placeholder="filename.ts"
            value={fileName}
          />
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button disabled={!fileName.trim()} onClick={handleCreate}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
