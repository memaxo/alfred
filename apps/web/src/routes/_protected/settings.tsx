import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { SettingsContent } from "@/components/windows/settings/content-tabs";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    // Show message that settings are now in desktop mode
    toast.info("Settings moved to desktop app", {
      description: "Open Settings from the desktop dock",
      duration: 4000,
    });
  }, []);

  // Show legacy content
  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-10">
      <div>
        <h1 className="font-bold text-3xl text-biolum tracking-tight">
          Settings
        </h1>
        <p className="text-biolum-dim">
          Settings are now available in the desktop app. Open Settings from the
          dock for the full experience.
        </p>
      </div>

      <SettingsContent
        mode="full"
        onNavigate={(path) => navigate({ to: path })}
      />
    </div>
  );
}
