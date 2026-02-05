import type { ThreadItem } from "@alfred/protocol";
import type { NodeProps } from "@xyflow/react";

import { mapAutonomyToAcpMode } from "@alfred/protocol";
import {
  Bot,
  ChevronLeft,
  Clock,
  Folder,
  History,
  Loader2,
  PauseCircle,
  Play,
  Settings2,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ThreadItemList } from "@/components/windows/codex/thread-items";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import {
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  TIMEOUT_MINUTES_OPTIONS,
} from "@/lib/codex-constants";
import { formatCodexErrorMessage } from "@/lib/codex-errors";
import {
  type CodexStreamEvent,
  subscribeToCodexStream,
} from "@/lib/codex/stream-client";
import { getToolToken } from "@/lib/token";
import { createBrowserTrpcProxyClient } from "@/lib/trpc-client";
import { useDesktopStore } from "@/store/desktop";

const MAX_LOG_ENTRIES = 200;

type AutoLevel = "read" | "low" | "medium" | "high";

const autoLevels: {
  label: string;
  value: AutoLevel;
  description: string;
}[] = [
  { label: "Read", value: "read", description: "Read-only, no modifications" },
  { label: "Low", value: "low", description: "Ask before changes" },
  { label: "Medium", value: "medium", description: "Autonomous code changes" },
  { label: "High", value: "high", description: "Full autonomy" },
];

interface LogEntry {
  id: string;
  channel: "stdout" | "stderr" | "system";
  text: string;
  at: string;
}

type RunStatus = "idle" | "running" | "completed" | "failed";

const codexWindowDataSchema = z.object({
  type: z.literal("codex"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  prompt: z.string().optional(),
  auto: z.enum(["read", "low", "medium", "high"]).optional(),
  cw: z.string().optional(),
  model: z.string().optional(),
  sessionId: z.string().optional(),
  status: z.enum(["idle", "running", "completed", "failed"]).optional(),
  log: z.array(z.unknown()).optional(),
  items: z.array(z.unknown()).optional(),
  error: z.string().optional(),
  timeoutSec: z.number().optional(),
});

export function CodexWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = codexWindowDataSchema.safeParse(data);
  const initial = parsed.success
    ? parsed.data
    : { type: "codex" as const, viewMode: "full" as const };

  const [prompt, setPrompt] = useState(initial.prompt ?? "");
  const [auto, setAuto] = useState<AutoLevel>(initial.auto ?? "medium");
  const [cw, setCw] = useState(initial.cw ?? "");
  const [model, setModel] = useState(initial.model ?? "");
  const [sessionId, setSessionId] = useState(initial.sessionId ?? "");
  const [status, setStatus] = useState<RunStatus>(initial.status ?? "idle");
  const [log, setLog] = useState<LogEntry[]>(
    Array.isArray(initial.log) ? (initial.log as LogEntry[]) : []
  );
  const [items, setItems] = useState<ThreadItem[]>(
    Array.isArray(initial.items) ? (initial.items as ThreadItem[]) : []
  );
  const [lastError, setLastError] = useState(initial.error ?? "");
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
    typeof subscribeToCodexStream
  > | null>(null);
  const clientRef = useRef<ReturnType<
    typeof createBrowserTrpcProxyClient
  > | null>(null);

  if (!clientRef.current) {
    try {
      clientRef.current = createBrowserTrpcProxyClient();
    } catch {
      clientRef.current = null;
    }
  }

  const appendLog = useCallback((entry: Omit<LogEntry, "id">) => {
    setLog((prev) => {
      const next = [...prev, { ...entry, id: nanoid() }];
      if (next.length > MAX_LOG_ENTRIES) {
        return next.slice(next.length - MAX_LOG_ENTRIES);
      }
      return next;
    });
  }, []);

  const updateOrAddItem = useCallback((item: ThreadItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const stopStream = useCallback(() => {
    subscriptionRef.current?.unsubscribe?.();
    subscriptionRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  useEffect(() => {
    updateWindowData(id, {
      draft: {
        prompt,
        auto,
        cw,
        model,
        sessionId,
        status,
        log,
        items,
        error: lastError || undefined,
        timeoutSec,
      },
    });
  }, [
    id,
    prompt,
    auto,
    cw,
    model,
    sessionId,
    status,
    log,
    items,
    lastError,
    timeoutSec,
    updateWindowData,
  ]);

  const handleStreamEvent = useCallback(
    (event: CodexStreamEvent) => {
      if (event.type === "stdout" || event.type === "stderr") {
        appendLog({
          channel: event.type,
          text: event.text,
          at: new Date().toISOString(),
        });
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

      if (event.type === "complete") {
        appendLog({
          channel: "system",
          text: `Completed${event.artifacts?.length ? ` (${event.artifacts.length} artifacts)` : ""}`,
          at: new Date().toISOString(),
        });
        setStatus("completed");
        return;
      }

      if (event.type === "error") {
        setLastError(event.message);
        setStatus("failed");
        appendLog({
          channel: "system",
          text: `Error: ${event.message}`,
          at: new Date().toISOString(),
        });
      }
    },
    [appendLog]
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
    setItems([]);

    const acpMode = mapAutonomyToAcpMode(auto);
    appendLog({
      channel: "system",
      text: `Starting Codex [mode: ${acpMode.name}, timeout: ${timeoutMinutes}m]`,
      at: new Date().toISOString(),
    });
    appendLog({
      channel: "system",
      text: `> ${prompt.trim()}`,
      at: new Date().toISOString(),
    });

    try {
      const token = await getToolToken(["codex.exec"], auto, {
        forceElevated: requiresElevation,
      });
      const authz = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

      const subscription = subscribeToCodexStream({
        client: clientRef.current,
        input: {
          prompt: prompt.trim(),
          auto,
          authz,
          cw: cw || undefined,
          model: model || undefined,
          sessionId: sessionId || undefined,
          timeoutSec,
        },
        onEvent: handleStreamEvent,
        onThreadItem: updateOrAddItem,
        onError: (err) => {
          const msg = formatCodexErrorMessage(err.message);
          setLastError(msg);
          setStatus("failed");
          appendLog({
            channel: "system",
            text: `Error: ${msg}`,
            at: new Date().toISOString(),
          });
        },
        onComplete: () => {
          setStatus("completed");
        },
      });
      subscriptionRef.current = subscription;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setLastError(msg);
      setStatus("failed");
      appendLog({
        channel: "system",
        text: `Error: ${msg}`,
        at: new Date().toISOString(),
      });
    }
  }, [
    prompt,
    auto,
    cw,
    model,
    sessionId,
    timeoutSec,
    timeoutMinutes,
    requiresElevation,
    stopStream,
    appendLog,
    handleStreamEvent,
    updateOrAddItem,
  ]);

  const handleStop = useCallback(() => {
    stopStream();
    setStatus("idle");
    appendLog({
      channel: "system",
      text: "Stopped by user",
      at: new Date().toISOString(),
    });
  }, [stopStream, appendLog]);

  const logScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logScrollRef.current) {
      const el = logScrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [log]);

  if (lod === "tiny") {
    return <TinyDot color="bg-cyan-500" shadow="shadow-cyan-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-cyan-500/20"
        hoverColor="hover:border-cyan-500/40"
        icon={<Terminal className="h-3 w-3" />}
        label="Codex"
        textColor="text-cyan-500"
      />
    );
  }

  const isRunning = status === "running";
  const headerIcon = (
    <Terminal
      className={`h-4 w-4 ${isRunning ? "animate-pulse text-cyan-400" : "text-cyan-500"}`}
    />
  );

  return (
    <WindowFrame
      actions={
        <div className="flex items-center gap-1">
          {headerIcon}
          <Button
            className="h-6 w-6 p-0"
            onClick={() => setShowSettings(!showSettings)}
            size="icon"
            title="Settings"
            variant="ghost"
          >
            <Settings2 className="h-3 w-3" />
          </Button>
          <Button
            className="h-6 w-6 p-0"
            onClick={() => setShowHistory(!showHistory)}
            size="icon"
            title="History"
            variant="ghost"
          >
            <History className="h-3 w-3" />
          </Button>
        </div>
      }
      id={id}
      selected={selected}
      title="Codex"
      width={650}
      windowType="codex"
    >
      <div className="flex h-full">
        {showHistory && (
          <div className="w-48 shrink-0 border-zinc-800 border-r p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-xs">History</span>
              <Button
                className="h-5 w-5 p-0"
                onClick={() => setShowHistory(false)}
                size="icon"
                variant="ghost"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-biolum-faint text-xs">
              Session history coming soon
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {showSettings && (
            <div className="border-zinc-800 border-b p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-biolum-dim text-xs">
                    Working Directory
                  </label>
                  <div className="flex gap-1">
                    <Input
                      className="h-7 text-xs"
                      disabled={isRunning}
                      onChange={(e) => setCw(e.target.value)}
                      placeholder="/path/to/project"
                      value={cw}
                    />
                    <Button
                      className="h-7 w-7 p-0"
                      disabled={isRunning}
                      size="icon"
                      variant="outline"
                    >
                      <Folder className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-biolum-dim text-xs">
                    Model
                  </label>
                  <Input
                    className="h-7 text-xs"
                    disabled={isRunning}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="default"
                    value={model}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-biolum-dim text-xs">
                    Session ID
                  </label>
                  <Input
                    className="h-7 text-xs"
                    disabled={isRunning}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="auto-generated"
                    value={sessionId}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-biolum-dim text-xs">
                    Timeout
                  </label>
                  <Select
                    disabled={isRunning}
                    onValueChange={(v) => setTimeoutMinutes(Number(v))}
                    value={String(timeoutMinutes)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_MINUTES_OPTIONS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} min
                          {m > ELEVATED_TIMEOUT_THRESHOLD_SEC / 60
                            ? " (elevated)"
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {requiresElevation && (
                <div className="mt-2 flex items-center gap-1 text-xs text-yellow-500">
                  <ShieldAlert className="h-3 w-3" />
                  Timeout requires biometric elevation
                </div>
              )}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="flex gap-2">
              <Select
                disabled={isRunning}
                onValueChange={(v) => setAuto(v as AutoLevel)}
                value={auto}
              >
                <SelectTrigger className="w-[120px]">
                  <Bot className="mr-1 h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {autoLevels.map((lvl) => (
                    <SelectItem key={lvl.value} value={lvl.value}>
                      <div className="flex flex-col">
                        <span>{lvl.label}</span>
                        <span className="text-biolum-dim text-xs">
                          {lvl.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea
                className="min-h-[60px] flex-1 resize-none text-sm"
                disabled={isRunning}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleRun();
                  }
                }}
                placeholder="What should Codex do?"
                value={prompt}
              />

              {isRunning ? (
                <Button
                  className="shrink-0"
                  onClick={handleStop}
                  size="sm"
                  variant="destructive"
                >
                  <PauseCircle className="mr-1 h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button className="shrink-0" onClick={handleRun} size="sm">
                  <Play className="mr-1 h-4 w-4" />
                  Run
                </Button>
              )}
            </div>

            {lastError && (
              <div className="rounded bg-red-500/10 p-2 text-red-400 text-xs">
                {lastError}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden rounded border border-zinc-800">
              <div className="flex h-full">
                <div className="flex-1 overflow-hidden border-zinc-800 border-r">
                  <div className="border-zinc-800 border-b bg-zinc-900/50 px-2 py-1 font-medium text-biolum-dim text-xs">
                    Activity
                  </div>
                  <ScrollArea className="h-[calc(100%-28px)] p-2">
                    <ThreadItemList items={items} />
                    {isRunning && items.length === 0 && (
                      <div className="flex items-center justify-center gap-2 text-biolum-dim text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div className="w-[200px] shrink-0 overflow-hidden">
                  <div className="border-zinc-800 border-b bg-zinc-900/50 px-2 py-1 font-medium text-biolum-dim text-xs">
                    Console
                  </div>
                  <ScrollArea
                    className="h-[calc(100%-28px)] bg-zinc-950"
                    ref={logScrollRef}
                  >
                    <div className="space-y-0.5 p-2 font-mono text-xs">
                      {log.map((entry) => (
                        <div
                          className={
                            entry.channel === "stderr"
                              ? "text-red-400"
                              : (entry.channel === "system"
                                ? "text-biolum-dim"
                                : "text-zinc-300")
                          }
                          key={entry.id}
                        >
                          {entry.text}
                        </div>
                      ))}
                      {log.length === 0 && (
                        <div className="text-biolum-faint">No output</div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}
