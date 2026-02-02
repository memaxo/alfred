import { Clock, Play, StopCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/utils/trpc";

export function TimersApp({ window: _window }: WindowComponentProps) {
  const [duration, setDuration] = useState("5");
  const [label, setLabel] = useState("");

  const utils = trpc.useUtils();
  const { data: timers, isLoading } = trpc.timer.active.useQuery();

  const createTimer = trpc.timer.create.useMutation({
    onSuccess: () => {
      utils.timer.active.invalidate();
      setLabel("");
      toast.success("Timer started");
    },
  });

  const cancelTimer = trpc.timer.cancel.useMutation({
    onSuccess: () => utils.timer.active.invalidate(),
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Number.parseInt(duration, 10);
    if (Number.isNaN(mins) || mins <= 0) {
      return;
    }

    createTimer.mutate({
      duration: mins * 60,
      label: label.trim() || undefined,
    });
  };

  return (
    <div className="flex h-full flex-col bg-void">
      <div className="flex h-10 items-center justify-between border-white/5 border-b bg-void-surface px-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Timers</span>
        </div>
      </div>

      <div className="border-white/5 border-b p-4">
        <form className="flex flex-col gap-3" onSubmit={handleStart}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                className="pr-10"
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Minutes"
                type="number"
                value={duration}
              />
              <span className="-translate-y-1/2 absolute top-1/2 right-3 text-biolum-dim text-xs">
                min
              </span>
            </div>
            <Button
              className="gap-2"
              disabled={createTimer.isPending}
              type="submit"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
          </div>
          <Input
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            value={label}
          />
        </form>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {isLoading ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              Loading timers...
            </div>
          ) : timers?.length === 0 ? (
            <div className="py-8 text-center text-biolum-dim text-sm italic">
              No active timers
            </div>
          ) : (
            timers?.map((timer) => (
              <TimerItem
                key={timer.id}
                onCancel={() => cancelTimer.mutate({ id: timer.id })}
                timer={timer}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TimerItem({
  timer,
  onCancel,
}: {
  timer: { id: string; label?: string | null; end: string };
  onCancel: () => void;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const end = new Date(timer.end).getTime();

    const update = () => {
      const now = Date.now();
      setRemaining(Math.max(0, Math.floor((end - now) / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timer.end]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20">
      <div className="min-w-0">
        <div className="truncate font-medium text-biolum text-sm">
          {timer.label || "Timer"}
        </div>
        <div className="font-mono text-biolum text-xl">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>
      <Button
        className="text-red-400 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onCancel}
        size="icon"
        variant="ghost"
      >
        <StopCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TimersAppWindow(props: WindowComponentProps) {
  return <TimersApp {...props} />;
}

export default TimersApp;
