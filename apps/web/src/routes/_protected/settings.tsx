import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SettingsContent } from "@/components/windows/settings/content-tabs";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-10">
      <div>
        <h1 className="font-bold text-3xl text-biolum tracking-tight">
          Settings
        </h1>
        <p className="text-biolum-dim">
          Manage your voice and application preferences.
        </p>
      </div>

      <SettingsContent
        mode="full"
        onNavigate={(path) => navigate({ to: path })}
      />
    </div>
  );
}
