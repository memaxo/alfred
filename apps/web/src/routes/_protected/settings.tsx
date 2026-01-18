import { createFileRoute } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  useEffect(() => {
    // Show message that settings are now in desktop mode
    toast.info("Settings moved to desktop app", {
      description: "Open Settings from the desktop dock for full access",
      duration: 4000,
    });
  }, []);

  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-10">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Settings2 className="h-8 w-8 text-biolum" />
          <h1 className="font-bold text-3xl text-biolum tracking-tight">
            Settings
          </h1>
        </div>
        <p className="text-biolum-dim text-lg">
          Settings are now available in the desktop app for a better experience.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="mb-4">
          <Settings2 className="mx-auto h-16 w-16 text-biolum opacity-50" />
        </div>
        <h2 className="mb-2 font-semibold text-xl">
          Unified Settings Desktop App
        </h2>
        <p className="mb-6 text-biolum-dim">
          All settings have been consolidated into a single desktop application
          with 10 organized categories for easier navigation.
        </p>
        <Button
          className="rounded-full"
          disabled
          size="lg"
          title="Open Settings from the desktop dock"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Available in Desktop Mode
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "Profile", desc: "User account & timezone" },
          { title: "Devices & Sessions", desc: "Active sessions & devices" },
          { title: "Security", desc: "Tokens, passkeys & permissions" },
          { title: "AI Models", desc: "Model configuration per role" },
          { title: "Voice & Speech", desc: "STT/TTS settings" },
          { title: "Embeddings", desc: "Model & device config" },
          { title: "Visual & Desktop", desc: "Appearance & effects" },
          { title: "MCP Servers", desc: "Protocol configuration" },
          { title: "Integrations", desc: "External services" },
          { title: "Notifications", desc: "Alert preferences" },
        ].map((item) => (
          <div
            className="rounded-xl border border-white/10 bg-white/5 p-4"
            key={item.title}
          >
            <div className="font-medium text-biolum text-sm">{item.title}</div>
            <div className="text-biolum-dim text-xs">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
