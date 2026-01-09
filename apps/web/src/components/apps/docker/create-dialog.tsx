"use client";

import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";

export type ContainerCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networks: Array<{ name: string }>;
  onCreated?: (containerId: string | null) => void;
};

export function ContainerCreateDialog({
  open,
  onOpenChange,
  networks,
  onCreated,
}: ContainerCreateDialogProps) {
  const [image, setImage] = useState("");
  const [name, setName] = useState("");
  const [network, setNetwork] = useState<string>("");
  const [portsText, setPortsText] = useState("");
  const [envText, setEnvText] = useState("");
  const [volumesText, setVolumesText] = useState("");
  const [cmd, setCmd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.deploy.containersCreate.useMutation({
    onSuccess: (result) => {
      onOpenChange(false);
      onCreated?.(result.id ?? null);
      setImage("");
      setName("");
      setNetwork("");
      setPortsText("");
      setEnvText("");
      setVolumesText("");
      setCmd("");
      setError(null);
    },
    onError: (e) => {
      setError(e.message || "Failed to create container");
    },
  });

  const parsed = useMemo(() => {
    const ports = parsePorts(portsText);
    const env = parseEnv(envText);
    const volumes = parseLines(volumesText);
    return { ports, env, volumes };
  }, [portsText, envText, volumesText]);

  const canSubmit = image.trim().length > 0 && !createMutation.isPending;

  const handleSubmit = () => {
    const img = image.trim();
    if (!img) {
      setError("Image is required");
      return;
    }
    const ports = parsed.ports;
    if (ports === null) {
      setError("Ports must be lines like 8080:80");
      return;
    }
    const env = parsed.env;
    if (env === null) {
      setError("Env must be lines like KEY=VALUE");
      return;
    }

    setError(null);
    createMutation.mutate({
      image: img,
      name: name.trim() || undefined,
      network: network.trim() || undefined,
      ports: ports.length > 0 ? ports : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      volumes: parsed.volumes.length > 0 ? parsed.volumes : undefined,
      cmd: cmd.trim() || undefined,
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-white/10 bg-void-surface">
        <DialogHeader>
          <DialogTitle>Create Container</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="docker-image">Image</Label>
            <Input
              className="border-white/10 bg-void"
              id="docker-image"
              onChange={(e) => setImage(e.target.value)}
              placeholder="e.g. nginx:latest"
              value={image}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="docker-name">Name (optional)</Label>
              <Input
                className="border-white/10 bg-void"
                id="docker-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="my-container"
                value={name}
              />
            </div>

            <div className="space-y-2">
              <Label>Network (optional)</Label>
              <Select onValueChange={setNetwork} value={network}>
                <SelectTrigger className="border-white/10 bg-void">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-void-surface">
                  <SelectItem value="">Default</SelectItem>
                  {networks.map((n) => (
                    <SelectItem key={n.name} value={n.name}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="docker-ports">Ports (optional)</Label>
            <Textarea
              className="min-h-[70px] border-white/10 bg-void font-mono text-xs"
              id="docker-ports"
              onChange={(e) => setPortsText(e.target.value)}
              placeholder={"8080:80\n5432:5432"}
              value={portsText}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="docker-env">Env (optional)</Label>
            <Textarea
              className="min-h-[70px] border-white/10 bg-void font-mono text-xs"
              id="docker-env"
              onChange={(e) => setEnvText(e.target.value)}
              placeholder={"NODE_ENV=production\nPORT=3000"}
              value={envText}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="docker-volumes">Volumes (optional)</Label>
            <Textarea
              className="min-h-[70px] border-white/10 bg-void font-mono text-xs"
              id="docker-volumes"
              onChange={(e) => setVolumesText(e.target.value)}
              placeholder={"my-volume:/data\n./local:/work"}
              value={volumesText}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="docker-cmd">Command (optional)</Label>
            <Input
              className="border-white/10 bg-void font-mono text-xs"
              id="docker-cmd"
              onChange={(e) => setCmd(e.target.value)}
              placeholder='e.g. sh -lc "node server.js"'
              value={cmd}
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

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter(Boolean);
}

function parsePorts(
  text: string
): Array<{ host: number; container: number }> | null {
  const lines = parseLines(text);
  if (lines.length === 0) {
    return [];
  }
  const out: Array<{ host: number; container: number }> = [];
  for (const line of lines) {
    const m = /^(\d{1,5}):(\d{1,5})$/u.exec(line);
    if (!(m?.[1] && m[2])) {
      return null;
    }
    const host = Number.parseInt(m[1], 10);
    const container = Number.parseInt(m[2], 10);
    if (
      !(host >= 1 && host <= 65_535 && container >= 1 && container <= 65_535)
    ) {
      return null;
    }
    out.push({ host, container });
  }
  return out;
}

function parseEnv(text: string): Record<string, string> | null {
  const lines = parseLines(text);
  if (lines.length === 0) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf("=");
    if (idx <= 0) {
      return null;
    }
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1);
    if (!k) {
      return null;
    }
    out[k] = v;
  }
  return out;
}
