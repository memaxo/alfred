import type { NodeProps } from "@xyflow/react";

import { Bot, Clock, PauseCircle, Play, ShieldAlert } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ObligationChallengeDialog } from "@/components/biometric-challenge-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/select";
import { Term } from "@/components/term";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useObligationResume } from "@/hooks/use-biometric-resume";
import {
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  TIMEOUT_MINUTES_OPTIONS,
} from "@/lib/codex-constants";
import { formatCodexErrorMessage } from "@/lib/codex-errors";
import {
  type DroidStreamEvent,
  subscribeToDroidStream,
} from "@/lib/droid/stream-client";
import { getToolToken } from "@/lib/token";
import { createBrowserTrpcProxyClient } from "@/lib/trpc-client";
import { useDesktopStore } from "@/store/desktop";

const MAX_LOG_ENTRIES = 400;

type AutoLevel = "read" | "low" | "medium" | "high";
type OutFormat = "text" | "json" | "debug";

const autoLevels: { label: string; value: AutoLevel }[] = [
  { label: "Read", value: "read" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

const outFormats: { label: string; value: OutFormat }[] = [
  { label: "Text", value: "text" },
  { label: "JSON", value: "json" },
  { label: "Debug", value: "debug" },
];

interface LogEntry {
  id: string;
  channel: "stdout" | "stderr" | "system";
  text: string;
  at: string;
}

type RunStatus = "idle" | "running" | "suspended" | "completed" | "failed";

const droidWindowDataSchema = z.object({
  type: z.literal("droid"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  prompt: z.string().optional(),
  auto: z.enum(["read", "low", "medium", "high"]).optional(),
  out: z.enum(["text", "json", "debug"]).optional(),
  status: z
    .enum(["idle", "running", "suspended", "completed", "failed"])
    .optional(),
  log: z.array(z.unknown()).optional(),
  error: z.string().optional(),
  lastRunId: z.string().optional(),
  timeoutSec: z.number().optional(),
});

export function DroidWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = droidWindowDataSchema.safeParse(data);
  const initial = parsed.success
    ? parsed.data
    : { type: "droid" as const, viewMode: "full" as const };

  const [prompt, setPrompt] = useState(initial.prompt ?? "");
  const [auto, setAuto] = useState<AutoLevel>(initial.auto ?? "low");
  const [out, setOut] = useState<OutFormat>(initial.out ?? "text");
  const [status, setStatus] = useState<RunStatus>(initial.status ?? "idle");
  const [log, setLog] = useState<LogEntry[]>(
    Array.isArray(initial.log) ? (initial.log as LogEntry[]) : []
  );
  const [lastError, setLastError] = useState(initial.error ?? "");
  const [activeRunId, setActiveRunId] = useState<string | null>(
    initial.lastRunId ?? null
  );
  const computedMinutes = Math.floor(
    ((initial.timeoutSec ?? ELEVATED_TIMEOUT_THRESHOLD_SEC) as number) / 60
  );
  const fallbackMinutes = Math.max(
    computedMinutes,
    TIMEOUT_MINUTES_OPTIONS[0] ?? 5
  );
  const initialTimeoutMinutes =
    TIMEOUT_MINUTES_OPTIONS.find((minutes) => minutes >= fallbackMinutes) ??
    TIMEOUT_MINUTES_OPTIONS.at(-1) ??
    5;
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(
    initialTimeoutMinutes
  );
  const timeoutSec = timeoutMinutes * 60;
  const requiresElevation = timeoutSec > ELEVATED_TIMEOUT_THRESHOLD_SEC;

  const updateWindowData = useDesktopStore((s) => s.updateWindowData);

  const subscriptionRef = useRef<ReturnType<
    typeof subscribeToDroidStream
  > | null>(null);
  const clientRef = useRef<ReturnType<
    typeof createBrowserTrpcProxyClient
  > | null>(null);

  if (!clientRef.current) {
    try {
      clientRef.current = createBrowserTrpcProxyClient();
    } catch {
      clientRef.current = {
        droid: {
          stream: {
            subscribe: () => ({
              subscribe: () => ({ unsubscribe() {} }),
            }),
          },
        },
      } as unknown as ReturnType<typeof createBrowserTrpcProxyClient>;
    }
  }

  const resume = useObligationResume({ target: "droid" });

  const appendLog = useCallback((entry: Omit<LogEntry, "id">) => {
    setLog((prev) => {
      const next = [...prev, { ...entry, id: nanoid() }];
      if (next.length > MAX_LOG_ENTRIES) {
        return next.slice(next.length - MAX_LOG_ENTRIES);
      }
      return next;
    });
  }, []);

  const stopStream = useCallback(() => {
    subscriptionRef.current?.unsubscribe?.();
    subscriptionRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopStream();
    },
    [stopStream]
  );

  useEffect(() => {
    updateWindowData(id, {
      // Store droid state in window data for persistence
      draft: {
        prompt,
        auto,
        out,
        status,
        log,
        error: lastError || undefined,
        lastRunId: activeRunId ?? undefined,
        timeoutSec,
      },
    });
  }, [
    id,
    prompt,
    auto,
    out,
    status,
    log,
    lastError,
    activeRunId,
    timeoutSec,
    updateWindowData,
  ]);

  const handleStreamEvent = useCallback(
    (event: DroidStreamEvent) => {
      if (event.type === "stdout" || event.type === "stderr") {
        appendLog({
          channel: event.type,
          text: event.data,
          at: new Date().toISOString(),
        });
        return;
      }

      if (event.type === "exit") {
        appendLog({
          channel: "system",
          text: `Process exited with code ${event.code}`,
          at: new Date().toISOString(),
        });
        setStatus(event.code === 0 ? "completed" : "failed");
        setActiveRunId(null);
        resume.close();
        return;
      }

      if (event.type === "notice") {
        appendLog({
          channel: "system",
          text: event.message,
          at: new Date().toISOString(),
        });
        return;
      }
    },
    [appendLog, resume]
  );

  const handleRun = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Prompt is required");
      return;
    }

    if (!clientRef.current) {
      toast.error("TRPC client unavailable");
      return;
    }

    stopStream();
    setStatus("running");
    setLastError("");
    setActiveRunId(null);
    resume.close();
    appendLog({
      channel: "system",
      text: `▶︎ ${prompt.trim()}`,
      at: new Date().toISOString(),
    });

    try {
      const token = await getToolToken(["droid.exec"], auto, {
        forceElevated: requiresElevation,
      });
      const authz = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      const subscription = subscribeToDroidStream({
        client: clientRef.current,
        input: {
          prompt: prompt.trim(),
          auto,
          authz,
          out,
          timeoutSec,
        },
        onEvent: handleStreamEvent,
        onObligation: (payload) => {
          setStatus("suspended");
          setActiveRunId(payload.runId);
          appendLog({
            channel: "system",
            text: "Biometric elevation required",
            at: new Date().toISOString(),
          });
          resume.prompt({
            runId: payload.runId,
            obligations: payload.obligations,
            resumeEvents: payload.resumeEvents ?? [],
          });
        },
        onResume: () => {
          appendLog({
            channel: "system",
            text: "Biometric check satisfied. Resuming...",
            at: new Date().toISOString(),
          });
          setStatus("running");
        },
        onError: (err) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          const msg = formatCodexErrorMessage(errMsg);
          setLastError(msg);
          setStatus("failed");
          resume.close();
          appendLog({
            channel: "system",
            text: `⚠ Error: ${msg}`,
            at: new Date().toISOString(),
          });
        },
      });
      subscriptionRef.current = subscription;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setLastError(msg);
      setStatus("failed");
      appendLog({
        channel: "system",
        text: `⚠ Error: ${msg}`,
        at: new Date().toISOString(),
      });
    }
  }, [
    prompt,
    auto,
    out,
    timeoutSec,
    requiresElevation,
    stopStream,
    appendLog,
    handleStreamEvent,
    resume,
  ]);

  const handleStop = useCallback(() => {
    stopStream();
    setStatus("idle");
    resume.close();
    appendLog({
      channel: "system",
      text: "Stopped by user",
      at: new Date().toISOString(),
    });
  }, [stopStream, appendLog, resume]);

  const logScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [log.length]);

  if (lod === "tiny") {
    return <TinyDot color="bg-emerald-500" shadow="shadow-emerald-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-emerald-500/20"
        hoverColor="hover:border-emerald-500/40"
        icon={<Bot className="h-3 w-3" />}
        label="Droid"
        textColor="text-emerald-500"
      />
    );
  }

  const isRunning = status === "running" || status === "suspended";
  const headerIcon = (
    <Bot
      className={`h-4 w-4 ${status === "running" ? "animate-pulse text-emerald-400" : "text-emerald-500"}`}
    />
  );

  return (
    <>
      <WindowFrame
        actions={headerIcon}
        id={id}
        selected={selected}
        title="Droid"
        width={500}
        windowType="droid"
      >
        <div className="flex flex-col gap-3 p-4">
          <Textarea
            className="min-h-[80px] resize-none"
            disabled={isRunning}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleRun();
              }
            }}
            placeholder="What should Droid do?"
            value={prompt}
          />

          <div className="flex items-center gap-2">
            <Select
              disabled={isRunning}
              onValueChange={(v) => setAuto(v as AutoLevel)}
              value={auto}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent>
                {autoLevels.map((lvl) => (
                  <SelectItem key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={isRunning}
              onValueChange={(v) => setOut(v as OutFormat)}
              value={out}
            >
              <SelectTrigger className="w-[90px]">
                <SelectValue placeholder="Out" />
              </SelectTrigger>
              <SelectContent>
                {outFormats.map((fmt) => (
                  <SelectItem key={fmt.value} value={fmt.value}>
                    {fmt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={isRunning}
              onValueChange={(v) => setTimeoutMinutes(Number(v))}
              value={String(timeoutMinutes)}
            >
              <SelectTrigger className="w-[90px]">
                <Clock className="mr-1 h-3 w-3" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEOUT_MINUTES_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m}m
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {requiresElevation && (
              <span title="Elevated timeout requires biometric">
                <ShieldAlert className="h-4 w-4 text-yellow-500" />
              </span>
            )}

            <div className="flex-1" />

            {isRunning ? (
              <Button onClick={handleStop} size="sm" variant="destructive">
                <PauseCircle className="mr-1 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={handleRun} size="sm">
                <Play className="mr-1 h-4 w-4" />
                Run
              </Button>
            )}
          </div>

          {status === "suspended" && (
            <div className="flex items-center gap-2 rounded bg-yellow-500/10 p-2 text-xs text-yellow-500">
              <ShieldAlert className="h-4 w-4" />
              Awaiting biometric verification
            </div>
          )}

          {lastError && (
            <div className="rounded bg-red-500/10 p-2 text-red-400 text-xs">
              {lastError}
            </div>
          )}

          <Term lines={log} maxHeight={200} scrollRef={logScrollRef} />
        </div>
      </WindowFrame>
      <ObligationChallengeDialog
        onClose={resume.close}
        onSuccess={resume.close}
        open={resume.isOpen}
        state={resume.pending}
        target="droid"
      />
    </>
  );
}
