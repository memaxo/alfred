/**
 * Privacy Settings Page
 *
 * Manage data privacy, autonomy levels, and stored facts/events.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Shield, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  type AutonomyLevel,
  AutonomySlider,
} from "@/components/autonomy-slider";
import { PrivacyControls } from "@/components/privacy-controls";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/settings/privacy")({
  component: PrivacySettingsPage,
});

export function PrivacySettingsPage() {
  const utils = trpc.useUtils();

  // Autonomy Level (stored as a preference)
  const { data: preferences } = trpc.preference.list.useQuery({ limit: 100 });
  const autonomyPreference = useMemo(
    () => preferences?.find((p) => p.key === "autonomy"),
    [preferences]
  );
  const currentAutonomy: AutonomyLevel =
    (autonomyPreference?.value as AutonomyLevel) ?? "low";

  const setPreference = trpc.preference.set.useMutation({
    onSuccess: () => {
      toast.success("Autonomy level updated");
      utils.preference.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update autonomy");
    },
  });

  const handleAutonomyChange = useCallback(
    (level: AutonomyLevel) => {
      setPreference.mutate({
        key: "autonomy",
        value: level,
        confidence: 1,
      });
    },
    [setPreference]
  );

  // Privacy Facts
  const { data: facts, isLoading: factsLoading } = trpc.privacy.facts.useQuery({
    limit: 50,
  });
  const deleteFact = trpc.privacy.deleteFact.useMutation({
    onSuccess: () => {
      toast.success("Fact deleted");
      utils.privacy.facts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete fact");
    },
  });

  // Privacy Events
  const { data: events, isLoading: eventsLoading } =
    trpc.privacy.events.useQuery({ limit: 50 });

  const handleExport = useCallback(() => {
    const data = {
      profile: preferences, // simplified for now
      facts,
      events,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alfred-privacy-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data export started");
  }, [preferences, facts, events]);

  const handlePurge = useCallback(() => {
    if (!facts || facts.length === 0) {
      toast.info("No facts to delete");
      return;
    }

    // In a real app, we'd have a bulk delete procedure.
    // For now, we delete facts one by one or explain why we can't.
    toast.promise(
      Promise.all(facts.map((f) => deleteFact.mutateAsync({ id: f.id }))),
      {
        loading: "Deleting all facts...",
        success: "All facts deleted",
        error: "Failed to delete some facts",
      }
    );
  }, [facts, deleteFact]);

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            className="mb-2 inline-flex items-center gap-1 text-biolum-dim text-sm transition-colors hover:text-biolum"
            to="/settings"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back to Settings
          </Link>
          <h1 className="font-bold text-3xl text-biolum tracking-tight">
            Privacy & Autonomy
          </h1>
          <p className="text-biolum-dim">
            Control your data and how much Alfred can do on your behalf.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          {/* Autonomy Section */}
          <section className="space-y-4 rounded-2xl border border-white/10 bg-void-surface/40 p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-biolum" strokeWidth={1.5} />
              <h2 className="font-semibold text-biolum text-lg">
                System Autonomy
              </h2>
            </div>
            <p className="text-biolum-dim text-sm">
              Define the level of independence Alfred has when executing tasks.
            </p>
            <AutonomySlider
              disabled={setPreference.isPending}
              onChange={handleAutonomyChange}
              value={currentAutonomy}
            />
          </section>

          {/* Privacy Controls (Bulk) */}
          <PrivacyControls
            className="border-white/10 bg-void-surface/40"
            forgetDisabled={
              deleteFact.isPending || !facts || facts.length === 0
            }
            onExport={handleExport}
            onForget={handlePurge}
          />
        </div>

        <div className="space-y-8">
          {/* Facts List */}
          <section className="flex h-[400px] flex-col space-y-4 rounded-2xl border border-white/10 bg-void-surface/40 p-6">
            <h2 className="font-semibold text-biolum text-lg">Stored Facts</h2>
            <p className="text-biolum-dim text-sm">
              Information Alfred has learned about you or your preferences.
            </p>
            <ScrollArea className="flex-1 pr-4">
              {factsLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
                </div>
              ) : facts && facts.length > 0 ? (
                <div className="space-y-3">
                  {facts.map((fact) => (
                    <div
                      className="group relative flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-sm transition-colors hover:bg-white/10"
                      key={fact.id}
                    >
                      <div className="space-y-1">
                        <p className="text-biolum">{fact.content}</p>
                        <div className="flex items-center gap-2 text-[10px] text-biolum-faint uppercase tracking-wider">
                          <span>{fact.category || "general"}</span>
                          <span>•</span>
                          <span>
                            {fact.created
                              ? new Date(fact.created).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <Button
                        className="h-8 w-8 text-red-400 opacity-0 transition-opacity group-hover:opacity-100"
                        disabled={deleteFact.isPending}
                        onClick={() => deleteFact.mutate({ id: fact.id })}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-xl border border-white/10 border-dashed">
                  <p className="text-biolum-faint text-sm">
                    No facts stored yet.
                  </p>
                </div>
              )}
            </ScrollArea>
          </section>

          {/* Events List */}
          <section className="flex h-[300px] flex-col space-y-4 rounded-2xl border border-white/10 bg-void-surface/40 p-6">
            <h2 className="font-semibold text-biolum text-lg">
              Privacy Events
            </h2>
            <p className="text-biolum-dim text-sm">
              Recent security and privacy-related actions.
            </p>
            <ScrollArea className="flex-1 pr-4">
              {eventsLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
                </div>
              ) : events && events.length > 0 ? (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs"
                      key={event.id}
                    >
                      <span className="font-medium text-biolum">
                        {event.type}
                      </span>
                      <span className="text-biolum-faint">
                        {event.timestamp
                          ? new Date(event.timestamp).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center">
                  <p className="text-biolum-faint text-sm">
                    No events recorded.
                  </p>
                </div>
              )}
            </ScrollArea>
          </section>
        </div>
      </div>
    </div>
  );
}
