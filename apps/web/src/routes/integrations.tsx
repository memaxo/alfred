import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BiolumBadge } from "@/components/tremor";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsRoute,
  errorComponent: RouteError,
});

function IntegrationsRoute() {
  // Query Linear webhook status (if procedure exists)
  // For now, we'll show static integration cards

  const handleLinearConnect = () => {
    // TODO: Implement Linear OAuth flow
    // Open popup window with Linear OAuth URL
    // Handle callback and token storage
    window.open("https://linear.app/oauth/authorize", "_blank");
  };

  const handleLaminarConnect = () => {
    // TODO: Implement Laminar connection
    // Navigate to Laminar settings or show API key input
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-biolum tracking-tighter">Integrations</CardTitle>
          <CardDescription className="text-biolum-dim">
            Connect ALFRED with your favorite tools and services.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Integration Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Linear Integration */}
        <Card className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-biolum tracking-tighter">Linear</CardTitle>
                <CardDescription className="text-biolum-dim">
                  Project management and issue tracking
                </CardDescription>
              </div>
              <BiolumBadge variant="default">
                Not Connected
              </BiolumBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-biolum-dim text-sm">
              Connect Linear to enable ALFRED to create issues, update status, and 
              provide real-time activity updates through Linear Agent Activities.
            </p>
            <div className="space-y-2">
              <h4 className="text-biolum text-sm font-medium">Features:</h4>
              <ul className="space-y-1 text-biolum-dim text-sm">
                <li>• Create and update issues</li>
                <li>• Real-time activity tracking</li>
                <li>• Workflow automation</li>
              </ul>
            </div>
            <Button
              onClick={handleLinearConnect}
              className="w-full rounded-full"
            >
              Connect Linear
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Laminar Integration */}
        <Card className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-biolum tracking-tighter">Laminar</CardTitle>
                <CardDescription className="text-biolum-dim">
                  LLM observability and evaluation
                </CardDescription>
              </div>
              <BiolumBadge variant={process.env.LMNR_PROJECT_API_KEY ? "success" : "default"}>
                {process.env.LMNR_PROJECT_API_KEY ? "Connected" : "Not Connected"}
              </BiolumBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-biolum-dim text-sm">
              Connect Laminar to export workflow evaluations, track LLM performance, 
              and monitor AI agent behavior.
            </p>
            <div className="space-y-2">
              <h4 className="text-biolum text-sm font-medium">Features:</h4>
              <ul className="space-y-1 text-biolum-dim text-sm">
                <li>• Export evaluations</li>
                <li>• Performance tracking</li>
                <li>• Distributed tracing</li>
              </ul>
            </div>
            <Button
              onClick={handleLaminarConnect}
              variant="outline"
              className="w-full rounded-full"
            >
              Configure Laminar
            </Button>
          </CardContent>
        </Card>

        {/* Proxmox Integration (Future) */}
        <Card className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-biolum tracking-tighter">Proxmox</CardTitle>
                <CardDescription className="text-biolum-dim">
                  Infrastructure management
                </CardDescription>
              </div>
              <BiolumBadge variant="default">
                Coming Soon
              </BiolumBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-biolum-dim text-sm">
              Connect Proxmox to manage VMs, containers, and infrastructure 
              automation through ALFRED.
            </p>
            <div className="space-y-2">
              <h4 className="text-biolum text-sm font-medium">Planned Features:</h4>
              <ul className="space-y-1 text-biolum-dim text-sm">
                <li>• VM management</li>
                <li>• Container orchestration</li>
                <li>• Resource monitoring</li>
              </ul>
            </div>
            <Button
              disabled
              variant="outline"
              className="w-full rounded-full"
            >
              Not Available Yet
            </Button>
          </CardContent>
        </Card>

        {/* Voice Models Integration */}
        <Card className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-biolum tracking-tighter">Local Voice Models</CardTitle>
                <CardDescription className="text-biolum-dim">
                  Privacy-preserving speech processing
                </CardDescription>
              </div>
              <BiolumBadge variant="success">
                Configured
              </BiolumBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-biolum-dim text-sm">
              Local voice models (Faster-Whisper STT + Piper TTS) provide zero-cost, 
              privacy-preserving voice processing.
            </p>
            <div className="space-y-2">
              <h4 className="text-biolum text-sm font-medium">Status:</h4>
              <ul className="space-y-1 text-biolum-dim text-sm">
                <li>• STT: Faster-Whisper (large-v3-turbo)</li>
                <li>• TTS: Piper (en_US-lessac-medium)</li>
                <li>• Device: Auto-detected GPU/CPU</li>
              </ul>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-full"
              asChild
            >
              <a href="/preferences">
                Manage in Preferences
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

