/**
 * Create Preview Section
 *
 * Form for creating new preview deployments.
 * Supports Docker build context, port configuration, and environment variables.
 */

import { Building2, Loader2, Rocket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/utils/trpc";

export function CreatePreviewSection() {
  const [appName, setAppName] = useState("");
  const [context, setContext] = useState(".");
  const [port, setPort] = useState("3000");
  const [dockerfile, setDockerfile] = useState("Dockerfile");

  const createMutation = trpc.deploy.createPreview.useMutation({
    onSuccess: (data) => {
      toast.success("Preview deployed successfully!", {
        description: `URL: ${data.url}`,
      });
      // Reset form
      setAppName("");
      setContext(".");
      setPort("3000");
      setDockerfile("Dockerfile");
    },
    onError: (error) => {
      toast.error("Failed to deploy preview", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) {
      toast.error("App name is required");
      return;
    }

    createMutation.mutate({
      app: appName.trim(),
      authz: "web-ui", // In production, this would be a proper auth token
      build: {
        context: context.trim() || ".",
        port: Number.parseInt(port, 10) || 3000,
        dockerfile: dockerfile.trim() || "Dockerfile",
      },
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium">Create Preview Deployment</h2>
          <p className="text-biolum-dim text-sm mt-1">
            Deploy a new preview environment to test your changes before
            promoting to production.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* App Name */}
          <div className="space-y-2">
            <Label htmlFor="appName">
              App Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="appName"
              placeholder="my-app"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
            />
            <p className="text-xs text-biolum-faint">
              A unique name for your application
            </p>
          </div>

          {/* Build Context */}
          <div className="space-y-2">
            <Label htmlFor="context">Build Context</Label>
            <Input
              id="context"
              placeholder="."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <p className="text-xs text-biolum-faint">
              Path to the build context (usually the project root)
            </p>
          </div>

          {/* Dockerfile */}
          <div className="space-y-2">
            <Label htmlFor="dockerfile">Dockerfile</Label>
            <Input
              id="dockerfile"
              placeholder="Dockerfile"
              value={dockerfile}
              onChange={(e) => setDockerfile(e.target.value)}
            />
            <p className="text-xs text-biolum-faint">
              Name of the Dockerfile to use
            </p>
          </div>

          {/* Port */}
          <div className="space-y-2">
            <Label htmlFor="port">Container Port</Label>
            <Input
              id="port"
              placeholder="3000"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
            <p className="text-xs text-biolum-faint">
              The port your application listens on
            </p>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              className="w-full gap-2"
              disabled={createMutation.isPending || !appName.trim()}
              size="lg"
              type="submit"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Deploy Preview
                </>
              )}
            </Button>
          </div>

          {/* Info Card */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 mt-6">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-biolum-dim mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">How it works</h4>
                <p className="text-biolum-dim text-xs mt-1">
                  Preview deployments create a temporary environment with a
                  unique URL. They are automatically removed when you promote to
                  production or manually delete them.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </ScrollArea>
  );
}
