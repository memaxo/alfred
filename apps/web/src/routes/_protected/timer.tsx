/**
 * Timer Pane Route
 *
 * Manages countdown timers with create, complete, and cancel operations.
 * Uses PaneLayout pattern with live updates for active timers.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  AlarmClock,
  Loader2,
  Play,
  Square,
  Timer as TimerIcon,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PaneLayout } from "@/components/pane-layout";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/timer")({
  component: TimerRoute,
  errorComponent: RouteError,
});

type TimerItem = {
  id: string;
  label: string | null;
  duration: number;
  startedAt: Date | null;
  completed: boolean;
  cancelled: boolean;
};

type TimerCardData = {
  id: string;
  label: string;
  remainingLabel: string;
  remainingSeconds: number;
  percent: number;
  isExpired: boolean;
};

function formatRemaining(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function TimerCreateForm() {
  const [minutes, setMinutes] = useState("25");
  const [label, setLabel] = useState("");

  const utils = trpc.useUtils();
  const createTimer = trpc.timer.create.useMutation({
    onSuccess: async () => {
      toast.success("Timer started");
      await utils.timer.active.invalidate();
      setMinutes("25");
      setLabel("");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to start timer");
    },
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const minutesValue = Number(minutes);
      if (!Number.isFinite(minutesValue) || minutesValue <= 0) {
        toast.error("Enter a positive duration in minutes");
        return;
      }
      if (minutesValue > 1440) {
        toast.error("Maximum duration is 24 hours (1440 minutes)");
        return;
      }
      createTimer.mutate({
        duration: Math.round(minutesValue * 60),
        label: label.trim() || undefined,
      });
    },
    [createTimer, label, minutes]
  );

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            max={1440}
            min={1}
            onChange={(event) => setMinutes(event.target.value)}
            placeholder="25"
            type="number"
            value={minutes}
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="label">Label (optional)</Label>
          <Input
            id="label"
            maxLength={128}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Focus session"
            value={label}
          />
        </div>
      </div>
      <Button
        className="w-full rounded-full"
        disabled={createTimer.isPending}
        type="submit"
      >
        {createTimer.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting…
          </span>
        ) : (
          <>
            <Play className="mr-1 h-4 w-4" />
            Start Timer
          </>
        )}
      </Button>
    </form>
  );
}

function TimerCard({
  timer,
  onComplete,
  onCancel,
  isActing,
}: {
  timer: TimerCardData;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  isActing: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-xl border p-4 transition-colors",
        "border-white/10 bg-void-surface/40",
        timer.isExpired && "border-purple-500/30 bg-purple-950/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              timer.isExpired ? "bg-purple-500/20" : "bg-biolum/10"
            )}
          >
            {timer.isExpired ? (
              <AlarmClock
                className="h-5 w-5 text-purple-300"
                strokeWidth={1.5}
              />
            ) : (
              <TimerIcon className="h-5 w-5 text-biolum" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <p className="font-medium text-biolum">{timer.label}</p>
            <p
              className={cn(
                "font-mono text-sm tabular-nums",
                timer.isExpired ? "text-purple-300" : "text-biolum-dim"
              )}
            >
              {timer.isExpired ? "Complete!" : timer.remainingLabel}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isActing}
            onClick={() => onComplete(timer.id)}
            size="sm"
            variant="secondary"
          >
            <Square className="mr-1 h-3 w-3" />
            Done
          </Button>
          <Button
            className="text-red-300"
            disabled={isActing}
            onClick={() => onCancel(timer.id)}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <Progress
          className={cn("h-2", timer.isExpired && "[&>div]:bg-purple-400")}
          value={timer.percent}
        />
      </div>
    </li>
  );
}

function TimerPane() {
  const [now, setNow] = useState(() => Date.now());

  // Live update every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const utils = trpc.useUtils();
  const timersQuery = trpc.timer.active.useQuery(undefined, {
    refetchInterval: 10_000, // Refetch every 10s for sync
  });

  const completeTimer = trpc.timer.done.useMutation({
    onSuccess: async () => {
      toast.success("Timer completed");
      await utils.timer.active.invalidate();
    },
    onError: (error) =>
      toast.error(error.message ?? "Failed to complete timer"),
  });

  const cancelTimer = trpc.timer.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Timer cancelled");
      await utils.timer.active.invalidate();
    },
    onError: (error) => toast.error(error.message ?? "Failed to cancel timer"),
  });

  const isActing = completeTimer.isPending || cancelTimer.isPending;
  const timers: TimerItem[] = (timersQuery.data ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    duration: t.duration,
    startedAt: t.start ? new Date(t.start) : null,
    completed: Boolean(t.completed),
    cancelled: Boolean(t.cancelled),
  }));

  const timerCards = useMemo<TimerCardData[]>(
    () =>
      timers.map((timer) => {
        const startedAt = timer.startedAt
          ? new Date(timer.startedAt).getTime()
          : Date.now();
        const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
        const remainingSeconds = Math.max(0, timer.duration - elapsedSeconds);
        const percent = Math.min(100, (elapsedSeconds / timer.duration) * 100);
        const isExpired = remainingSeconds <= 0;

        return {
          id: timer.id,
          label: timer.label ?? "Timer",
          remainingLabel: formatRemaining(remainingSeconds),
          remainingSeconds,
          percent,
          isExpired,
        };
      }),
    [timers, now]
  );

  const handleComplete = useCallback(
    (id: string) => {
      completeTimer.mutate({ id });
    },
    [completeTimer]
  );

  const handleCancel = useCallback(
    (id: string) => {
      cancelTimer.mutate({ id });
    },
    [cancelTimer]
  );

  if (timersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-biolum-faint">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading timers…
      </div>
    );
  }

  if (timerCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-biolum/10">
          <AlarmClock className="h-8 w-8 text-biolum-faint" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-biolum-dim">No active timers</p>
        <p className="text-biolum-faint text-sm">
          Create a timer above to get started
        </p>
      </div>
    );
  }

  // Sort by remaining time (expired first, then shortest remaining)
  const sortedCards = [...timerCards].sort((a, b) => {
    if (a.isExpired && !b.isExpired) {
      return -1;
    }
    if (!a.isExpired && b.isExpired) {
      return 1;
    }
    return a.remainingSeconds - b.remainingSeconds;
  });

  return (
    <ul className="space-y-3">
      {sortedCards.map((timer) => (
        <TimerCard
          isActing={isActing}
          key={timer.id}
          onCancel={handleCancel}
          onComplete={handleComplete}
          timer={timer}
        />
      ))}
    </ul>
  );
}

export function TimerRoute() {
  return (
    <PaneLayout
      createForm={<TimerCreateForm />}
      description="Create and manage countdown timers for focus sessions"
      paneComponent={<TimerPane />}
      title="Timers"
    />
  );
}
