import { Activity, Brain, Flame, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useCognitiveFeedback } from "@/hooks/use-cognitive-feedback";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface EventSummary {
  kind?: unknown;
  reason?: unknown;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatPct(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

export function WorkflowCognitiveBadge({
  streamId,
  className,
}: {
  streamId: string;
  className?: string;
}) {
  const stateQuery = trpc.cognitive.state.useQuery(
    { streamId },
    { refetchInterval: 2000 }
  );
  const physQuery = trpc.cognitive.physiologyGet.useQuery(
    { streamId },
    { refetchInterval: 2000 }
  );
  const eventsQuery = trpc.cognitive.eventsList.useQuery(
    { streamId, limit: 12 },
    { refetchInterval: 4000 }
  );

  const feedback = useCognitiveFeedback();

  const autonomyLevel = stateQuery.data?.autonomy?.level;
  const phase = stateQuery.data?.phase ?? null;
  const phys = physQuery.data ?? null;

  const lastInterruptReason = useMemo(() => {
    const events = eventsQuery.data?.events ?? [];
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const e = events[i] as EventSummary;
      if (e.kind === "interrupt" && typeof e.reason === "string") {
        return e.reason;
      }
    }
    return null;
  }, [eventsQuery.data?.events]);

  const disabled =
    feedback.status === "pending" ||
    stateQuery.isLoading ||
    physQuery.isLoading;

  const submit = async (kind: "up" | "down") => {
    const expected = "thumbs_up";
    const actual = kind === "up" ? expected : "";
    await feedback.submit({ actual, expected, streamId, surface: "mindscape" });
    await Promise.all([
      stateQuery.refetch(),
      physQuery.refetch(),
      eventsQuery.refetch(),
    ]);
  };

  const energy =
    phys && typeof phys.energy === "number" ? clamp01(phys.energy) : null;
  const frustration =
    phys && typeof phys.frustration === "number"
      ? clamp01(phys.frustration)
      : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-void-surface/40 px-3 py-2 text-biolum-dim text-xs backdrop-blur",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-biolum" />
          <span className="font-medium text-biolum">
            {phase ? `Cognitive: ${phase}` : "Cognitive"}
          </span>
          {typeof autonomyLevel === "number" &&
          Number.isFinite(autonomyLevel) ? (
            <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-biolum">
              auto {formatPct(autonomyLevel)}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {energy !== null ? (
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-400" />
              energy {formatPct(energy)}
            </span>
          ) : null}
          {frustration !== null ? (
            <span className="inline-flex items-center gap-1">
              <Flame
                className={cn(
                  "h-3 w-3",
                  frustration > 0.7 ? "text-orange-400" : "text-biolum-dim"
                )}
              />
              fr {formatPct(frustration)}
            </span>
          ) : null}
          {lastInterruptReason ? (
            <span className="truncate">
              last interrupt:{" "}
              <span className="text-biolum">{lastInterruptReason}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          disabled={disabled}
          onClick={() => {
            submit("up").catch(() => {});
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          disabled={disabled}
          onClick={() => {
            submit("down").catch(() => {});
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
