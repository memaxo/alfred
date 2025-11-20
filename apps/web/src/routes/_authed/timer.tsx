import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useState } from "react";
import { TimerPane, type TimerPaneItem } from "@alfred/ui";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaneLayout } from "@/components/pane-layout";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_authed/timer")({
  component: TimerRoute,
  errorComponent: RouteError,
});

function TimerRoute() {
  const utils = trpc.useUtils();
  const [duration, setDuration] = useState("");
  const [label, setLabel] = useState("");

  const activeTimersQuery = trpc.timer.active.useQuery();
  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;
  type TimerListItem = RouterOutputs["timer"]["active"][number];
  const timers: TimerListItem[] = activeTimersQuery.data ?? [];
  const isLoading = activeTimersQuery.isLoading;

  const createTimer = trpc.timer.create.useMutation({
    onSuccess: async () => {
      await utils.timer.active.invalidate();
      setDuration("");
      setLabel("");
    },
  });

  const completeTimer = trpc.timer.done.useMutation({
    onSuccess: async () => {
      await utils.timer.active.invalidate();
    },
  });

  const cancelTimer = trpc.timer.cancel.useMutation({
    onSuccess: async () => {
      await utils.timer.active.invalidate();
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const durationMinutes = Number.parseInt(duration, 10);
    if (Number.isNaN(durationMinutes) || durationMinutes <= 0) {
      return;
    }
    const input: RouterInputs["timer"]["create"] = {
      duration: durationMinutes * 60, // Convert minutes to seconds
      label: label.trim() || undefined,
    };
    createTimer.mutate(input);
  };

  const handleComplete = (id: string) => {
    const input: RouterInputs["timer"]["done"] = { id };
    completeTimer.mutate(input);
  };

  const handleCancel = (id: string) => {
    const input: RouterInputs["timer"]["cancel"] = { id };
    cancelTimer.mutate(input);
  };

  const paneItems: TimerPaneItem[] = useMemo(
    () =>
      timers.map((timer) => ({
        id: timer.id,
        duration: timer.duration,
        label: timer.label,
        startedAt: timer.startedAt ? timer.startedAt.toISOString() : null,
        completedAt: timer.completedAt ? timer.completedAt.toISOString() : null,
        cancelledAt: timer.cancelledAt ? timer.cancelledAt.toISOString() : null,
      })),
    [timers]
  );

  // Auto-refresh timers every second for live countdown
  useEffect(() => {
    if (timers.length === 0) return;
    
    const interval = setInterval(() => {
      // Force re-render by invalidating query
      utils.timer.active.invalidate();
    }, 1000);

    return () => clearInterval(interval);
  }, [timers.length, utils]);

  const createForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="timer-duration">Duration (minutes)</Label>
        <Input
          id="timer-duration"
          type="number"
          min="1"
          step="1"
          placeholder="e.g., 25"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timer-label">Label (optional)</Label>
        <Input
          id="timer-label"
          type="text"
          placeholder="e.g., Focus Session"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={createTimer.isPending}
      >
        {createTimer.isPending ? "Starting..." : "Start Timer"}
      </Button>
    </form>
  );

  const paneComponent = isLoading ? (
    <div className="text-biolum-dim text-center py-8">Loading timers...</div>
  ) : (
    <TimerPane
      items={paneItems}
      onComplete={handleComplete}
      onCancel={handleCancel}
    />
  );

  return (
    <PaneLayout
      title="Timers"
      description="Start a timer to focus on a task or track time."
      createForm={createForm}
      paneComponent={paneComponent}
    />
  );
}

