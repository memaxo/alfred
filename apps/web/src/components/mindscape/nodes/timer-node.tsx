import type { NodeProps } from "@xyflow/react";
import { AlarmClock, Loader2, Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMindscapeStore } from "@/store/mindscape";
import { timerNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { useLOD, useNodeFocus } from "../lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

export function TimerNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  const parsed = timerNodeDataSchema.safeParse(data);
  const timerData = parsed.success
    ? parsed.data
    : { defaultMinutes: 25, lastLabel: undefined };
  const [minutes, setMinutes] = useState(
    String(timerData.defaultMinutes ?? 25)
  );
  const [label, setLabel] = useState(timerData.lastLabel ?? "");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMinutes(String(timerData.defaultMinutes ?? 25));
    setLabel(timerData.lastLabel ?? "");
  }, [timerData.defaultMinutes, timerData.lastLabel]);

  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const utils = trpc.useUtils();
  const timersQuery = trpc.timer.active.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const timers = timersQuery.data ?? [];

  const createTimer = trpc.timer.create.useMutation({
    onSuccess: async () => {
      toast.success("Timer started");
      updateArtifactData(id, {
        defaultMinutes: Number(minutes) || timerData.defaultMinutes,
        lastLabel: label.trim() || undefined,
      });
      await utils.timer.active.invalidate();
      setLabel("");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to start timer");
    },
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

  const handleStart = (event: React.FormEvent) => {
    event.preventDefault();
    const minutesValue = Number(minutes);
    if (!Number.isFinite(minutesValue) || minutesValue <= 0) {
      toast.error("Enter a positive duration");
      return;
    }
    createTimer.mutate({
      duration: minutesValue * 60,
      label: label.trim() || undefined,
    });
  };

  const timerCards = useMemo(
    () =>
      timers.map((timer) => {
        const startedAt = timer.startedAt
          ? new Date(timer.startedAt).getTime()
          : Date.now();
        const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
        const remaining = Math.max(0, timer.duration - elapsedSeconds);
        const percent = Math.min(100, (elapsedSeconds / timer.duration) * 100);

        return {
          id: timer.id,
          label: timer.label ?? "Focus Timer",
          remainingLabel: formatRemaining(remaining),
          percent,
        };
      }),
    [timers, now]
  );

  // LOD 0: Tiny
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-purple-500" shadow="shadow-purple-500/50" />;
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-purple-500/20"
        hoverColor="hover:border-purple-500/40"
        icon={<AlarmClock className="h-3 w-3" />}
        label="Timers"
        textColor="text-purple-500"
      />
    );
  }

  return (
    <MindscapeNode
      className="w-[360px] border-purple-500/20 bg-purple-950/10"
      headerActions={<AlarmClock className="h-4 w-4 text-purple-300" />}
      id={id}
      selected={selected}
      title="Timers"
    >
      <div className="flex flex-col gap-3 p-4">
        <form className="flex flex-col gap-2" onSubmit={handleStart}>
          <div className="flex gap-2">
            <Input
              min={1}
              onChange={(event) => setMinutes(event.target.value)}
              placeholder="Minutes"
              type="number"
              value={minutes}
            />
            <Button disabled={createTimer.isPending} type="submit">
              {createTimer.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting
                </span>
              ) : (
                <>
                  <Play className="mr-1 h-4 w-4" /> Start
                </>
              )}
            </Button>
          </div>
          <Input
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (optional)"
            value={label}
          />
        </form>

        <ScrollArea className="h-[220px] rounded-md border border-white/10 p-2">
          {timersQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-biolum-faint text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading timers…
            </div>
          ) : timerCards.length === 0 ? (
            <p className="py-4 text-center text-biolum-faint text-sm">
              No active timers. Start one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {timerCards.map((timer) => (
                <li
                  className="rounded-md border border-white/10 bg-white/5 p-3"
                  key={timer.id}
                >
                  <div className="flex items-center justify-between font-medium text-sm">
                    <span>{timer.label}</span>
                    <span className="text-purple-200 tabular-nums">
                      {timer.remainingLabel}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-purple-400 transition-all"
                      style={{ width: `${timer.percent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={isActing}
                      onClick={() => completeTimer.mutate({ id: timer.id })}
                      size="sm"
                      variant="secondary"
                    >
                      <Square className="mr-1 h-3 w-3" />
                      Done
                    </Button>
                    <Button
                      className="flex-1 text-red-300"
                      disabled={isActing}
                      onClick={() => cancelTimer.mutate({ id: timer.id })}
                      size="sm"
                      variant="ghost"
                    >
                      <Pause className="mr-1 h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </MindscapeNode>
  );
}

function formatRemaining(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(whole / 60)
    .toString()
    .padStart(2, "0");
  const secs = (whole % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}
