import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";

export interface VolumeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function VolumeCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: VolumeCreateDialogProps) {
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.deploy.volumesCreate.useMutation({
    onSuccess: () => {
      void utils.deploy.volumesList.invalidate();
      onOpenChange(false);
      onCreated?.();
      setName("");
      setDriver("");
      setError(null);
    },
    onError: (e) => setError(e.message || "Failed to create volume"),
  });

  const canSubmit = name.trim().length > 0 && !createMutation.isPending;

  const handleSubmit = () => {
    const n = name.trim();
    if (!n) {
      setError("Name is required");
      return;
    }
    setError(null);
    createMutation.mutate({
      name: n,
      driver: driver.trim() || undefined,
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-white/10 bg-void-surface">
        <DialogHeader>
          <DialogTitle>Create Volume</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="docker-volume-name">Name</Label>
            <Input
              className="border-white/10 bg-void"
              id="docker-volume-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="my-volume"
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="docker-volume-driver">Driver (optional)</Label>
            <Input
              className="border-white/10 bg-void"
              id="docker-volume-driver"
              onChange={(e) => setDriver(e.target.value)}
              placeholder="local"
              value={driver}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
