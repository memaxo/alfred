import { eventToUiMessages } from "@alfred/api/src/ai/normalize";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { UIMessage } from "@alfred/type/stream";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BiometricChallengeDialog } from "@/components/biometric-challenge-dialog";
import { Code } from "@/components/code";
import { Plan } from "@/components/plan";
import { RouteError } from "@/components/route-error";
import { Task } from "@/components/task";
import { Tool } from "@/components/tool";
import { getToolToken } from "@/lib/token";
import { parseStructuredMessage } from "@/utils/message-parser";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

const autoLevels = ["read", "low", "medium", "high"] as const;
const COMPLETE_PERCENT = 100;

type AutoLevel = (typeof autoLevels)[number];

type LogEntry = {
  id: number;
  type: string;
  message: string;
};

type RouterInputs = inferRouterInputs<TRPCAppRouter>;
type StreamInput = RouterInputs["workflow"]["stream"];
type WorkflowResumeInput = RouterInputs["workflow"]["resume"];
type ScopeEvent = WorkflowResumeInput["event"];
type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type WorkflowReplayOutput = RouterOutputs["workflow"]["replay"];
type WorkflowReplayItem = WorkflowReplayOutput["items"][number];

const VALID_SCOPE_EVENTS = new Set<ScopeEvent>([
  "deploy-authz",
  "linear-authz",
  "bio-authz",
]);

export const Route = createFileRoute("/_authed/orchestrator/run")({
  component: OrchestratorRunRoute,
  errorComponent: RouteError,
  ssr: false,
});

function OrchestratorRunRoute() {
  const queryClient = useQueryClient();
  const [streamInput, setStreamInput] = useState<StreamInput | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [requirement, setRequirement] = useState("");
  const [auto, setAuto] = useState<AutoLevel>("low");
  const [cwd, setCwd] = useState("");
  const [mode, setMode] = useState<"sequential" | "parallel">("sequential");
  const [repoBase, setRepoBase] = useState("origin/main");
  const [workspace, setWorkspace] = useState("");
  const [contextEnabled, setContextEnabled] = useState(true);
  const [contextWeb, setContextWeb] = useState(true);
  const [contextMaxTokens, setContextMaxTokens] = useState("24000");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const logCount = logs.length;
  const subscriptionRef = useRef<null | (() => void)>(null);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const scopeInFlightRef = useRef<Set<ScopeEvent>>(new Set());
  const resumeMutation = trpc.workflow.resume.useMutation();
  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(new Set());
  const seenEventIdsRef = useRef(seenEventIds);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const hasNewer = page > 0 && order === "desc"; // when newest-first, pages > 0 have newer pages
  const [_oldestEventId, setOldestEventId] = useState<string | null>(null);
  const [_newestEventId, setNewestEventId] = useState<string | null>(null);
  const [showBiometricDialog, setShowBiometricDialog] = useState(false);
  const [biometricWorkflowId, setBiometricWorkflowId] = useState<string | null>(null);
  useEffect(() => {
    seenEventIdsRef.current = seenEventIds;
  }, [seenEventIds]);

  const mergeMessages = useCallback(
    (incoming: UIMessage[], direction: "prepend" | "append") => {
      if (!incoming.length) {
        return;
      }
      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const filtered = incoming.filter(
          (message) => message.id && !existingIds.has(message.id)
        );
        if (!filtered.length) {
          return prev;
        }
        return direction === "prepend"
          ? [...filtered, ...prev]
          : [...prev, ...filtered];
      });
    },
    []
  );

  const rememberEventIds = useCallback((ids: Iterable<string>) => {
    setSeenEventIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const processReplayResponse = useCallback(
    (data?: WorkflowReplayOutput) => {
      if (!data) {
        return;
      }
      const items = data.items ?? [];
      if (items.length === 0) {
        setHasMore(Boolean(data.hasMore));
        return;
      }
      const unseen = collectUnseenReplayItems(items, seenEventIdsRef.current);
      if (unseen.messages.length > 0) {
        mergeMessages(unseen.messages, order === "desc" ? "prepend" : "append");
      }
      if (unseen.ids.length > 0) {
        rememberEventIds(unseen.ids);
      }
      setHasMore(Boolean(data.hasMore));
      updateReplayBoundaries(items, order, setNewestEventId, setOldestEventId);
    },
    [mergeMessages, order, rememberEventIds]
  );
  const _eventsQuery = trpc.workflow.replay.useQuery(
    {
      runId: runId ?? "",
      eventType: "ui-message",
      order,
      page,
      pageSize: 200,
      includeTotal: false,
    },
    {
      enabled: Boolean(runId),
      // hydrate messages from persisted UI-message events
      onSuccess: processReplayResponse,
      keepPreviousData: true,
    }
  );

  const canStart = useMemo(
    () => requirement.trim().length > 0 && !isRunning,
    [requirement, isRunning]
  );

  const currentStreamInput = streamInput ?? undefined;

  const appendLog = useCallback((type: string, message: string) => {
    if (!message) {
      return;
    }
    logIdRef.current += 1;
    setLogs((prev) => [...prev, { id: logIdRef.current, type, message }]);
  }, []);

  function clearLogs() {
    logIdRef.current = 0;
    setLogs([]);
  }

  useEffect(
    () => () => {
      subscriptionRef.current?.();
      subscriptionRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!logContainerRef.current || logCount === 0) {
      return;
    }
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logCount]);

  function stopCurrentSubscription() {
    subscriptionRef.current?.();
    subscriptionRef.current = null;
    setStreamInput(null);
    setRunId(null);
    scopeInFlightRef.current.clear();
  }

  const buildStreamInput = useCallback(
    (authz: string): StreamInput => {
      const trimmedRequirement = requirement.trim();
      const baseInput: StreamInput = {
        requirement: trimmedRequirement,
        auto,
        authz,
        cw: cwd.trim() || undefined,
        mode,
        repoBase: repoBase.trim() || undefined,
        workspace: workspace.trim() || undefined,
      };

      const maxTokensValue = Number.parseInt(contextMaxTokens, 10);
      if (contextEnabled) {
        baseInput.context = {
          enable: true,
          web: contextWeb,
          maxTokens: Number.isFinite(maxTokensValue)
            ? maxTokensValue
            : undefined,
        };
      } else {
        baseInput.context = { enable: false };
      }

      return baseInput;
    },
    [
      auto,
      contextEnabled,
      contextMaxTokens,
      contextWeb,
      cwd,
      mode,
      repoBase,
      requirement,
      workspace,
    ]
  );

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart) {
      return;
    }

    setError(null);
    setStatus(null);
    setProgress(0);
    clearLogs();
    setIsRunning(true);
    setRunId(null);
    scopeInFlightRef.current.clear();

    stopCurrentSubscription();

    try {
      const token = await getToolToken(
        ["droid.exec", "repo.read", "repo.write"],
        auto
      );
      const authz = `Bearer ${token}`;
      setStreamInput(buildStreamInput(authz));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start workflow";
      setError(message);
      appendLog("error", message);
      setIsRunning(false);
    }
  }

  const appendStreamMessages = useCallback(
    (event: WorkflowEvent) => {
      const maybeUiMessages = eventToUiMessages(event);
      if (maybeUiMessages?.length) {
        mergeMessages(maybeUiMessages, "append");
      }
    },
    [mergeMessages]
  );

  const rememberStreamEventId = useCallback(
    (id?: string | null) => {
      if (!id) {
        return;
      }
      rememberEventIds([id]);
    },
    [rememberEventIds]
  );

  const handleRunEvent = useCallback(
    (event: StreamEventPayload) => {
      const id = typeof event.id === "string" ? event.id : null;
      if (!id) {
        return;
      }
      setRunId(id);
      appendLog("info", `run started (${id})`);
      setStatus("Running");
    },
    [appendLog]
  );

  const handleStatusEvent = useCallback(
    (event: StreamEventPayload) => {
      let nextStatus: string | null = null;
      if (typeof event.state === "string") {
        nextStatus = event.state;
      } else if (typeof event.message === "string") {
        nextStatus = event.message;
      }
      if (!nextStatus) {
        return;
      }
      setStatus(nextStatus);
      appendLog("status", nextStatus);
    },
    [appendLog]
  );

  const handleProgressEvent = useCallback(
    (event: StreamEventPayload) => {
      const pct = typeof event.pct === "number" ? event.pct : undefined;
      if (typeof pct === "number") {
        setProgress((prev) => (pct > prev ? pct : prev));
      }
      if (typeof event.message === "string") {
        appendLog("progress", event.message);
      }
    },
    [appendLog]
  );

  const getTextPayload = useCallback(
    (event: StreamEventPayload | null | undefined) => {
      if (!event) {
        return "";
      }
      if (typeof event.text === "string") {
        return event.text;
      }
      if (typeof event.data === "string") {
        return event.data;
      }
      return "";
    },
    []
  );

  const handleStdEvent = useCallback(
    (event: StreamEventPayload, label: "stdout" | "stderr") => {
      const text = getTextPayload(event);
      if (text) {
        appendLog(label, text);
      }
    },
    [appendLog, getTextPayload]
  );

  const handleNoticeEvent = useCallback(
    (event: StreamEventPayload) => {
      const baseMessage =
        typeof event.message === "string"
          ? event.message
          : JSON.stringify(event);
      const moduleId = typeof event.module === "string" ? event.module : null;
      const taskId = typeof event.task === "string" ? event.task : null;
      const noticeError = typeof event.error === "string" ? event.error : null;
      const scoped = moduleId
        ? `module ${moduleId}${taskId ? ` task ${taskId}` : ""}: ${baseMessage}`
        : baseMessage;
      const message = noticeError ? `${scoped} (${noticeError})` : scoped;
      appendLog("notice", message);
    },
    [appendLog]
  );

  const handleErrorEvent = useCallback(
    (event: StreamEventPayload) => {
      const message =
        typeof event.message === "string" ? event.message : "workflow_error";
      
      // Check if error is due to biometric requirement (high-risk operation)
      if (
        message.includes("biometric_required") ||
        message.includes("PRECONDITION_FAILED")
      ) {
        // Show biometric challenge dialog for high-risk operations
        if (runId) {
          setBiometricWorkflowId(runId);
          setShowBiometricDialog(true);
          setStatus("Suspended - Biometric Required");
          appendLog("notice", "Workflow suspended: biometric authentication required");
        } else {
          setError(message);
          appendLog("error", message);
          setStatus("Error");
        }
      } else {
        setError(message);
        appendLog("error", message);
        setStatus("Error");
      }
    },
    [appendLog, runId]
  );

  const handleCacheEvent = useCallback(
    (event: StreamEventPayload) => {
      const key = Array.isArray(event.key) ? event.key : undefined;
      if (!key) {
        return;
      }
      queryClient.setQueryData(key, event.value);
      appendLog("cache", `Cache handoff for key: ${JSON.stringify(key)}`);
    },
    [appendLog, queryClient]
  );

  const handleScopeRequest = useCallback(
    (event: StreamEventPayload) => {
      const scopes = Array.isArray(event.scopes)
        ? event.scopes.map((scope) => String(scope))
        : [];
      const scopeEventRaw =
        typeof event.event === "string" ? (event.event as ScopeEvent) : null;
      if (!(runId && scopeEventRaw)) {
        appendLog(
          "error",
          "Unable to satisfy scope request (missing run id or event)"
        );
        return;
      }
      if (!VALID_SCOPE_EVENTS.has(scopeEventRaw)) {
        appendLog("error", `Unknown scope request event: ${scopeEventRaw}`);
        return;
      }
      appendLog(
        "notice",
        `Scope request received for ${scopeEventRaw} (${
          scopes.join(", ") || "<none>"
        })`
      );
      if (scopeInFlightRef.current.has(scopeEventRaw)) {
        appendLog("info", `Scope request ${scopeEventRaw} already in progress`);
        return;
      }
      scopeInFlightRef.current.add(scopeEventRaw);
      
      // For bio-authz, show biometric dialog instead of automatically getting token
      if (scopeEventRaw === "bio-authz") {
        setBiometricWorkflowId(runId);
        setShowBiometricDialog(true);
        setStatus("Suspended - Biometric Required");
        scopeInFlightRef.current.delete(scopeEventRaw);
        return;
      }
      
      (async () => {
        try {
          const token = await getToolToken(scopes, auto);
          await resumeMutation.mutateAsync({
            runId,
            event: scopeEventRaw,
            authz: `Bearer ${token}`,
          });
          appendLog("info", `Provided scopes for ${scopeEventRaw}`);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to provide scope";
          appendLog("error", message);
          setError(message);
          setStatus("Error");
          setIsRunning(false);
          setStreamInput(null);
          setRunId(null);
          subscriptionRef.current?.();
          subscriptionRef.current = null;
        } finally {
          scopeInFlightRef.current.delete(scopeEventRaw);
        }
      })();
    },
    [appendLog, auto, resumeMutation, runId]
  );

  const handleContextEvent = useCallback(
    (event: StreamEventPayload) => {
      appendLog("context", buildContextSummary(event));
    },
    [appendLog]
  );

  const handleChunk = useCallback(
    (chunk: unknown) => {
      if (!isStreamEventPayload(chunk)) {
        return;
      }
      if (chunk.eventId && seenEventIdsRef.current.has(chunk.eventId)) {
        return;
      }
      rememberStreamEventId(chunk.eventId);
      appendStreamMessages(chunk);

      switch (chunk.type) {
        case "run":
          handleRunEvent(chunk);
          return;
        case "status":
          handleStatusEvent(chunk);
          return;
        case "progress":
          handleProgressEvent(chunk);
          return;
        case "stdout":
          handleStdEvent(chunk, "stdout");
          return;
        case "stderr":
          handleStdEvent(chunk, "stderr");
          return;
        case "droid":
          appendLog(
            "droid",
            JSON.stringify(chunk.chunk ?? chunk.data ?? chunk)
          );
          return;
        case "notice":
          handleNoticeEvent(chunk);
          return;
        case "error":
          handleErrorEvent(chunk);
          return;
        case "data-cache-handoff":
          handleCacheEvent(chunk);
          return;
        case "require-scope":
          handleScopeRequest(chunk);
          return;
        case "context":
          handleContextEvent(chunk);
          return;
        default:
          appendLog(chunk.type ?? "unknown", JSON.stringify(chunk));
      }
    },
    [
      appendLog,
      appendStreamMessages,
      handleCacheEvent,
      handleContextEvent,
      handleErrorEvent,
      handleNoticeEvent,
      handleProgressEvent,
      handleRunEvent,
      handleScopeRequest,
      handleStatusEvent,
      handleStdEvent,
      rememberStreamEventId,
    ]
  );

  trpc.workflow.stream.useSubscription(currentStreamInput, {
    enabled: streamInput !== null,
    onStarted(unsubscribe: () => void) {
      subscriptionRef.current = unsubscribe;
    },
    onData: handleChunk,
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      
      // Check if error is due to biometric requirement
      if (
        message.includes("biometric_required") ||
        message.includes("PRECONDITION_FAILED")
      ) {
        // Show biometric challenge dialog
        if (runId) {
          setBiometricWorkflowId(runId);
          setShowBiometricDialog(true);
          setStatus("Suspended - Biometric Required");
          appendLog("notice", "Workflow suspended: biometric authentication required");
        } else {
          setError(message);
          appendLog("error", message);
          setStatus("Error");
          setIsRunning(false);
          setStreamInput(null);
          setRunId(null);
          scopeInFlightRef.current.clear();
          subscriptionRef.current?.();
          subscriptionRef.current = null;
        }
      } else {
        setError(message);
        appendLog("error", message);
        setStatus("Error");
        setIsRunning(false);
        setStreamInput(null);
        setRunId(null);
        scopeInFlightRef.current.clear();
        subscriptionRef.current?.();
        subscriptionRef.current = null;
      }
    },
    onComplete() {
      appendLog("info", "Workflow completed");
      setStatus("Completed");
      setProgress((prev) =>
        prev < COMPLETE_PERCENT ? COMPLETE_PERCENT : prev
      );
      setIsRunning(false);
      setStreamInput(null);
      setRunId(null);
      scopeInFlightRef.current.clear();
      subscriptionRef.current?.();
      subscriptionRef.current = null;
    },
  });

  function handleStop() {
    stopCurrentSubscription();
    setIsRunning(false);
    setStatus("Stopped");
    appendLog("info", "Workflow stopped by user");
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl">Orchestrator Run Viewer</h1>
        <p className="text-muted-foreground text-sm">
          Start a plan workflow, stream logs in real time, and exercise token
          elevation for droid executions.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleStart}>
        <div className="grid gap-2">
          <label className="font-medium text-sm" htmlFor="requirement">
            Requirement
          </label>
          <textarea
            className="min-h-[120px] w-full rounded border border-input bg-background px-3 py-2 text-sm"
            id="requirement"
            onChange={(event) => setRequirement(event.target.value)}
            placeholder="Describe the task for the orchestrator..."
            required
            value={requirement}
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="auto">
              Autonomy Level
            </label>
            <select
              className="h-10 rounded border border-input bg-background px-3 text-sm"
              id="auto"
              onChange={(event) => setAuto(event.target.value as AutoLevel)}
              value={auto}
            >
              {autoLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="cwd">
              Working Directory (optional)
            </label>
            <input
              className="h-10 rounded border border-input bg-background px-3 text-sm"
              id="cwd"
              onChange={(event) => setCwd(event.target.value)}
              placeholder="/srv/alfred"
              type="text"
              value={cwd}
            />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="mode">
              Execution Mode
            </label>
            <select
              className="h-10 rounded border border-input bg-background px-3 text-sm"
              id="mode"
              onChange={(event) =>
                setMode(event.target.value as "sequential" | "parallel")
              }
              value={mode}
            >
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel (experimental)</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="repoBase">
              Base Ref
            </label>
            <input
              className="h-10 rounded border border-input bg-background px-3 text-sm"
              id="repoBase"
              onChange={(event) => setRepoBase(event.target.value)}
              placeholder="origin/main"
              type="text"
              value={repoBase}
            />
          </div>
          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="workspace">
              Linear Workspace (optional)
            </label>
            <input
              className="h-10 rounded border border-input bg-background px-3 text-sm"
              id="workspace"
              onChange={(event) => setWorkspace(event.target.value)}
              placeholder="org-id"
              type="text"
              value={workspace}
            />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <label className="flex items-center gap-2 font-medium text-sm">
            <input
              checked={contextEnabled}
              className="h-4 w-4"
              onChange={(event) => setContextEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>Enable context gather</span>
          </label>
          <label className="flex items-center gap-2 font-medium text-sm">
            <input
              checked={contextWeb}
              className="h-4 w-4"
              disabled={!contextEnabled}
              onChange={(event) => setContextWeb(event.target.checked)}
              type="checkbox"
            />
            <span>Include web search</span>
          </label>
          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="contextMaxTokens">
              Context max tokens
            </label>
            <input
              className="h-10 rounded border border-input bg-background px-3 text-sm"
              disabled={!contextEnabled}
              id="contextMaxTokens"
              max={200_000}
              min={2000}
              onChange={(event) => setContextMaxTokens(event.target.value)}
              type="number"
              value={contextMaxTokens}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex h-9 items-center justify-center rounded bg-primary px-4 font-medium text-primary-foreground text-sm disabled:opacity-50"
            disabled={!canStart}
            type="submit"
          >
            {isRunning ? "Running..." : "Start plan"}
          </button>
          <button
            className="inline-flex h-9 items-center justify-center rounded border border-input px-4 font-medium text-sm disabled:opacity-50"
            disabled={!isRunning}
            onClick={handleStop}
            type="button"
          >
            Stop
          </button>
          <div className="text-muted-foreground text-sm">
            Progress: {Math.round(progress)}%{status ? ` · ${status}` : null}
          </div>
        </div>

        {auto === "medium" || auto === "high" ? (
          <p className="text-muted-foreground text-xs">
            Medium/high autonomy requires passkey verification. You will be
            prompted automatically when the run starts.
          </p>
        ) : null}
      </form>

      {error ? (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2">
          <header className="flex items-center justify-between">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Stream Output
            </h2>
          </header>
          <div
            className="h-80 w-full overflow-y-auto rounded border border-input bg-background p-3 font-mono text-sm"
            ref={logContainerRef}
          >
            {logs.length === 0 ? (
              <p className="text-muted-foreground">
                No output yet. Start a run to view logs.
              </p>
            ) : (
              <ul className="space-y-1">
                {logs.map((entry) => (
                  <li key={entry.id}>
                    <span className="text-muted-foreground">
                      [{entry.type}]
                    </span>{" "}
                    {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <header className="flex items-center justify-between">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              UI Messages (replay + live)
            </h2>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-8 items-center justify-center rounded border border-input px-3 text-xs disabled:opacity-50"
                disabled={!hasNewer}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                title="Load newer"
                type="button"
              >
                Load newer
              </button>
              <button
                className="inline-flex h-8 items-center justify-center rounded border border-input px-3 text-xs disabled:opacity-50"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                title="Load older"
                type="button"
              >
                Load older
              </button>
              <button
                className="inline-flex h-8 items-center justify-center rounded border border-input px-3 text-xs"
                onClick={() => {
                  setOrder("desc");
                  setPage(0);
                }}
                title="Jump to newest"
                type="button"
              >
                Jump to newest
              </button>
              <button
                className="inline-flex h-8 items-center justify-center rounded border border-input px-3 text-xs"
                onClick={() => {
                  setPage(0);
                  setOrder((o) => (o === "desc" ? "asc" : "desc"));
                }}
                title="Toggle order"
                type="button"
              >
                Order: {order === "desc" ? "Newest first" : "Oldest first"}
              </button>
            </div>
          </header>
          <div className="h-80 w-full space-y-4 overflow-y-auto rounded border border-input bg-background p-3">
            {messages.length === 0 ? (
              <p className="text-muted-foreground">No messages persisted.</p>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const parsed = parseStructuredMessage(message);
                  return (
                    <div className="space-y-2" key={message.id ?? parsed.id}>
                      {parsed.plans.map((plan, idx) => (
                        <Plan key={plan.id ?? `plan-${idx}`} plan={plan} />
                      ))}
                      {parsed.tasks.map((task) => (
                        <Task key={task.id} {...task} />
                      ))}
                      {parsed.tools.map((tool, idx) => (
                        <Tool
                          args={tool.args}
                          key={tool.id ?? `tool-${idx}`}
                          name={tool.name}
                          result={tool.result}
                          status={tool.status}
                        />
                      ))}
                      {parsed.codes.map((code, idx) => (
                        <Code
                          code={code.code}
                          key={code.id ?? `code-${idx}`}
                          language={code.language}
                        />
                      ))}
                      {parsed.plans.length === 0 &&
                      parsed.tasks.length === 0 &&
                      parsed.tools.length === 0 &&
                      parsed.codes.length === 0 ? (
                        <pre className="text-muted-foreground text-xs">
                          {JSON.stringify(message, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <BiometricChallengeDialog
        open={showBiometricDialog}
        onClose={() => {
          setShowBiometricDialog(false);
          setBiometricWorkflowId(null);
        }}
        onSuccess={() => {
          setShowBiometricDialog(false);
          setBiometricWorkflowId(null);
          // Workflow will automatically resume via the dialog's resume call
        }}
        workflowId={biometricWorkflowId ?? undefined}
      />
    </div>
  );
}

type StreamEventPayload = WorkflowEvent & { eventId?: string };

function buildContextSummary(event: StreamEventPayload): string {
  const phase = typeof event.phase === "string" ? event.phase : "unknown";
  const summaryParts: string[] = [`phase=${phase}`];
  if (typeof event.message === "string" && event.message.trim()) {
    summaryParts.push(event.message.trim());
  }
  const receipts = isPlainObject(event.receipts) ? event.receipts : {};
  const bundle = isPlainObject(event.bundle) ? event.bundle : {};
  if (typeof receipts.summary === "string" && receipts.summary.trim()) {
    summaryParts.push(receipts.summary.trim());
  }
  if (Array.isArray(receipts.code)) {
    summaryParts.push(`code=${receipts.code.length}`);
  }
  if (Array.isArray(receipts.web)) {
    summaryParts.push(`web=${receipts.web.length}`);
  }
  if (Array.isArray(bundle.files)) {
    summaryParts.push(`bundle.files=${bundle.files.length}`);
  }
  if (typeof bundle.estimatedTokens === "number") {
    summaryParts.push(`bundle.tokens≈${bundle.estimatedTokens}`);
  }
  return summaryParts.join(" | ");
}

function collectUnseenReplayItems(
  items: WorkflowReplayItem[],
  seenIds: Set<string>
) {
  const incomingMessages: UIMessage[] = [];
  const ids: string[] = [];

  for (const item of items) {
    const evtId = typeof item.eventId === "string" ? item.eventId : null;
    if (evtId && seenIds.has(evtId)) {
      continue;
    }
    if (evtId) {
      ids.push(evtId);
    }
    const uiMessages = getUiMessagesFromReplayItem(item);
    if (uiMessages?.length) {
      incomingMessages.push(...uiMessages);
    }
  }

  return { messages: incomingMessages, ids };
}

function updateReplayBoundaries(
  items: WorkflowReplayItem[],
  order: "asc" | "desc",
  setNewest: (id: string) => void,
  setOldest: (id: string) => void
) {
  const first = items[0];
  const last = items.at(-1);
  if (!(first?.eventId && last?.eventId)) {
    return;
  }
  if (order === "desc") {
    setNewest(first.eventId);
    setOldest(last.eventId);
    return;
  }
  setOldest(first.eventId);
  setNewest(last.eventId);
}

function isStreamEventPayload(value: unknown): value is StreamEventPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUiMessage(value: unknown): value is UIMessage {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.role === "string" &&
    Array.isArray(value.parts)
  );
}

function isUiMessageArray(value: unknown): value is UIMessage[] {
  return Array.isArray(value) && value.every(isUiMessage);
}

function toWorkflowEvent(
  eventType: string,
  eventData: unknown
): WorkflowEvent | null {
  if (!isPlainObject(eventData)) {
    return null;
  }
  const type =
    typeof (eventData as { type?: unknown }).type === "string"
      ? (eventData as { type: string }).type
      : eventType;
  return { ...(eventData as Record<string, unknown>), type } as WorkflowEvent;
}

function getUiMessagesFromReplayItem(
  row: WorkflowReplayItem
): UIMessage[] | null {
  if (row.eventType === "ui-message" && isUiMessageArray(row.eventData)) {
    return row.eventData;
  }
  const workflowEvent = toWorkflowEvent(row.eventType, row.eventData);
  return workflowEvent ? (eventToUiMessages(workflowEvent) ?? null) : null;
}
