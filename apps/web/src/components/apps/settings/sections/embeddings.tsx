/**
 * Embeddings Settings Section
 *
 * Configure embedding model selection, device, and pool size.
 */

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";

export function EmbeddingsSection() {
  const { data: config, isLoading } = trpc.embed.getConfig.useQuery();
  const setConfig = trpc.embed.setConfig.useMutation();

  const [device, setDevice] = useState<string>("auto");
  const [poolSize, setPoolSize] = useState<number>(2);

  const handleSave = () => {
    setConfig.mutate(
      { device: device as "auto" | "cpu" | "cuda" | "mps", poolSize },
      {
        onSuccess: () => {
          toast.success("Embedding settings saved. Restart required.");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to save settings");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-biolum" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="font-semibold text-lg">Embeddings</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          Select embedding model (KaLM text-only or Qwen multimodal), device,
          and pool size.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="space-y-2">
          <Label>Model</Label>
          <p className="text-biolum-dim text-xs">
            Current: {config?.modelName || "Not configured"}
          </p>
          <p className="text-amber-400 text-xs">
            Model configuration requires restart to take effect
          </p>
        </div>

        <div className="space-y-2">
          <Label>Device</Label>
          <Select onValueChange={setDevice} value={device}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="cpu">CPU</SelectItem>
              <SelectItem value="cuda">CUDA (NVIDIA GPU)</SelectItem>
              <SelectItem value="mps">MPS (Apple Silicon)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-biolum-dim text-xs">
            Current: {config?.device || "auto"}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Pool Size: {poolSize}</Label>
          <input
            className="w-full accent-biolum"
            max="10"
            min="1"
            onChange={(e) => setPoolSize(Number.parseInt(e.target.value))}
            type="range"
            value={poolSize}
          />
          <p className="text-biolum-dim text-xs">
            Current: {config?.poolSize || 2} workers
          </p>
        </div>

        <Button disabled={setConfig.isPending} onClick={handleSave}>
          {setConfig.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
