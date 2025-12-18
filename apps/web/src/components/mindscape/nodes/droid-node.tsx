import type { NodeProps } from "@xyflow/react";
import {
  Bot,
  Clock,
  PauseCircle,
  Play,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ObligationChallengeDialog } from "@/components/biometric-challenge-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { useMindscapeStore } from "@/store/mindscape";
import { droidNodeDataSchema } from "@/store/mindscape.schemas";
import { useLOD, useNodeFocus } from "../lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

const MAX_LOG_ENTRIES = 400;
const TIMEOUT_THRESHOLD_MINUTES = ELEVATED_TIMEOUT_THRESHOLD_SEC / 60;

type AutoLevel = "read" | "low" | "medium" | "high";
type OutFormat = "text" | "json" | "debug";

const autoLevels: Array<{ label: string; value: AutoLevel }> = [
  { label: "Read", value: "read" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

const outFormats: Array<{ label: string; value: OutFormat }> = [
  { label: "Text", value: "text" },
  { label: "JSON", value: "json" },
  { label: "Debug", value: "debug" },
];

type LogEntry = {
  id: string;
  channel: "stdout" | "stderr" | "system";
  text: string;
  at: string;
};

type RunStatus = "idle" | "running" | "suspended" | "completed" | "failed";

export function DroidNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  const parsed = droidNodeDataSchema.safeParse(data);
  const initial = parsed.success
    ? parsed.data
    : {
        prompt: "",
        auto: "low" as const,
        out: "text" as const,
        status: "idle" as RunStatus,
        log: [] as LogEntry[],
        error: undefined,
        lastRunId: undefined,
        timeoutSec: ELEVATED_TIMEOUT_THRESHOLD_SEC,
      };

  const allowedAutoValues: AutoLevel[] = ["read", "low", "medium", "high"];
  const initialAuto: AutoLevel = allowedAutoValues.includes(
    initial.auto as AutoLevel
  )
    ? (initial.auto as AutoLevel)
    : "low";
  const initialOut: OutFormat = (
    ["text", "json", "debug"] as OutFormat[]
  ).includes(initial.out as OutFormat)
    ? (initial.out as OutFormat)
    : "text";

  const [prompt, setPrompt] = useState(initial.prompt ?? "");
  const [auto, setAuto] = useState<AutoLevel>(initialAuto);
  const [out, setOut] = useState<OutFormat>(initialOut);
  const [status, setStatus] = useState<RunStatus>(
    (initial.status as RunStatus) ?? "idle"
  );
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
    TIMEOUT_MINUTES_OPTIONS[TIMEOUT_MINUTES_OPTIONS.length - 1] ??
    5;
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(
    initialTimeoutMinutes
  );
  const timeoutSec = timeoutMinutes * 60;
  const requiresElevation = timeoutSec > ELEVATED_TIMEOUT_THRESHOLD_SEC;

  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const subscriptionRef = useRef<ReturnType<
    typeof subscribeToDroidStream
  > | null>(null);
  const clientRef = useRef<ReturnType<
    typeof createBrowserTrpcProxyClient
  > | null>(null);

  if (!clientRef.current) {
    try {
      clientRef.current = createBrowserTrpcProxyClient();
    } catch (error) {
      console.warn("droid-node: falling back to noop trpc client", error);
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

  const resume = useObligationResume({
    target: "droid",
  });

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
    updateArtifactData(id, {
      type: "droid",
      prompt,
      auto,
      out,
      status,
      log,
      error: lastError || undefined,
      lastRunId: activeRunId ?? undefined,
      timeoutSec,
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
    updateArtifactData,
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
          resume.close();
        },
        onError: (error) => {
          setStatus("failed");
          const userMessage = formatCodexErrorMessage(error.message);
          setLastError(userMessage);
          appendLog({
            channel: "system",
            text: `Error: ${userMessage}`,
            at: new Date().toISOString(),
          });
          resume.close();
        },
        onComplete: () => {
          resume.close();
        },
      });
      subscriptionRef.current = subscription;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Failed to start droid";
      const message = formatCodexErrorMessage(rawMessage);
      setLastError(message);
      setStatus("failed");
      appendLog({
        channel: "system",
        text: `Error: ${message}`,
        at: new Date().toISOString(),
      });
      toast.error(message);
    }
  }, [
    appendLog,
    auto,
    handleStreamEvent,
    out,
    prompt,
    requiresElevation,
    resume,
    stopStream,
    timeoutSec,
  ]);

  const handleStop = useCallback(() => {
    stopStream();
    setStatus("idle");
    setActiveRunId(null);
    resume.close();
    appendLog({
      channel: "system",
      text: "Stopped",
      at: new Date().toISOString(),
    });
  }, [appendLog, resume, stopStream]);

  const statusBadge = useMemo(() => {
    switch (status) {
      case "running":
        return "text-biolum";
      case "suspended":
        return "text-amber-400";
      case "completed":
        return "text-emerald-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-biolum-faint";
    }
  }, [status]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "test") {
      return;
    }
    const globalScope = globalThis as unknown as {
      __droidTestHooks__?: Record<
        string,
        { run: () => Promise<void>; stop: () => void }
      >;
    };
    if (!globalScope.__droidTestHooks__) {
      globalScope.__droidTestHooks__ = {};
    }
    globalScope.__droidTestHooks__[id] = {
      run: async () => {
        await handleRun();
      },
      stop: handleStop,
    };
    return () => {
      delete globalScope.__droidTestHooks__?.[id];
    };
  }, [handleRun, handleStop, id]);

  if (lod === "tiny") {
    return (
      <NodeLODTiny
        color={status === "running" ? "bg-biolum" : "bg-biolum-dim"}
        shadow="shadow-biolum/30"
      />
    );
  }

  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-biolum/20"
        hoverColor="hover:border-biolum/40"
        icon={<Bot className="h-3 w-3" />}
        label="Droid Exec"
        textColor="text-biolum"
      />
    );
  }

  return (
    <>
      <MindscapeNode
        className="w-[440px]"
        headerActions={
          <div className="flex items-center gap-2 text-xs">
            <span className={`${statusBadge} uppercase tracking-wide`}>
              {status}
            </span>
            {activeRunId && (
              <span className="font-mono text-[10px] text-biolum-faint">
                {activeRunId.slice(0, 8)}
              </span>
            )}
          </div>
        }
        id={id}
        nodeType="droid"
        selected={selected}
        title="Droid Exec"
      >
        <div className="flex flex-col gap-3 p-4">
          <Textarea
            aria-label="Droid prompt"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the task for droid..."
            rows={3}
            value={prompt}
          />
          <div className="flex items-center gap-3">
            <Select
              onValueChange={(value) => setAuto(value as AutoLevel)}
              value={auto}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Autonomy" />
              </SelectTrigger>
              <SelectContent>
                {autoLevels.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => setOut(value as OutFormat)}
              value={out}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Output" />
              </SelectTrigger>
              <SelectContent>
                {outFormats.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="flex-1"
              data-testid="droid-run-button"
              onClick={status === "running" ? handleStop : handleRun}
              variant={status === "running" ? "secondary" : "default"}
            >
              {status === "running" ? (
                <>
                  <PauseCircle className="mr-2 h-4 w-4" /> Stop
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> Run
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-3 text-biolum-faint text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-biolum" />
              <span>Timeout</span>
            </div>
            <Select
              onValueChange={(value) => setTimeoutMinutes(Number(value))}
              value={String(timeoutMinutes)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Timeout" />
              </SelectTrigger>
              <SelectContent>
                {TIMEOUT_MINUTES_OPTIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-biolum">
              {(timeoutSec / 60).toFixed(0)} min max runtime
            </span>
          </div>
          {requiresElevation && (
            <div className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-200 text-xs">
              <ShieldAlert className="h-3 w-3" />
              Timeouts above {TIMEOUT_THRESHOLD_MINUTES} min require passkey
              confirmation.
            </div>
          )}
          <div className="rounded-lg border border-white/10 bg-black/40">
            <div className="flex items-center gap-2 border-white/5 border-b px-3 py-2 text-biolum-faint text-xs">
              <Terminal className="h-3 w-3" /> Live Stream
              {status === "suspended" && (
                <span className="ml-auto flex items-center gap-1 text-amber-300">
                  <ShieldAlert className="h-3 w-3" /> Awaiting biometric
                </span>
              )}
            </div>
            <ScrollArea className="h-48" type="always">
              <div className="space-y-1 px-3 py-2 font-mono text-xs">
                {log.length === 0 && (
                  <p className="text-biolum-faint">No output yet.</p>
                )}
                {log.map((entry) => (
                  <p
                    className={
                      entry.channel === "stderr"
                        ? "text-red-300"
                        : entry.channel === "system"
                          ? "text-biolum-faint"
                          : "text-biolum"
                    }
                    key={entry.id}
                  >
                    [{new Date(entry.at).toLocaleTimeString()}] {entry.text}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>
          {lastError && <p className="text-red-400 text-sm">{lastError}</p>}
        </div>
      </MindscapeNode>
      <ObligationChallengeDialog
        mode="external"
        onClose={() => {
          resume.close();
        }}
        onSuccess={() => {
          setStatus("running");
        }}
        open={resume.isOpen}
        state={resume.pending}
        target="droid"
      />
    </>
  );
}
