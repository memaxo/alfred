import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPCClient } from "@/utils/trpc";
import { getToolToken } from "@/lib/token";

const autoLevels = ["read", "low", "medium", "high"] as const;

type AutoLevel = (typeof autoLevels)[number];

type LogEntry = {
	id: number;
	type: string;
	message: string;
};

export const Route = createFileRoute("/orchestrator/run")({
	component: OrchestratorRunRoute,
});

function OrchestratorRunRoute() {
	const trpcClient = useTRPCClient();
	const queryClient = useQueryClient();
	const [requirement, setRequirement] = useState("");
	const [auto, setAuto] = useState<AutoLevel>("low");
	const [cwd, setCwd] = useState("");
	const [mode, setMode] = useState<"sequential" | "parallel">("sequential");
	const [repoBase, setRepoBase] = useState("origin/main");
	const [workspace, setWorkspace] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [progress, setProgress] = useState(0);
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const subscriptionRef = useRef<null | (() => void)>(null);
	const logIdRef = useRef(0);
	const logContainerRef = useRef<HTMLDivElement | null>(null);

	const canStart = useMemo(() => requirement.trim().length > 0 && !isRunning, [requirement, isRunning]);

	function appendLog(type: string, message: string) {
		if (!message) return;
		logIdRef.current += 1;
		setLogs(prev => [...prev, { id: logIdRef.current, type, message }]);
	}

	function clearLogs() {
		logIdRef.current = 0;
		setLogs([]);
	}

	useEffect(() => {
		return () => {
			subscriptionRef.current?.();
			subscriptionRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!logContainerRef.current) return;
		logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
	}, [logs]);

	function stopCurrentSubscription() {
		subscriptionRef.current?.();
		subscriptionRef.current = null;
	}

	async function handleStart(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canStart) return;

		setError(null);
		setStatus(null);
		setProgress(0);
		clearLogs();
		setIsRunning(true);

		stopCurrentSubscription();

		try {
			const token = await getToolToken(
				["droid.exec", "repo.read", "repo.write", "deploy.write", "tickets.write"],
				auto,
			);
			const authz = `Bearer ${token}`;

			const unsubscribe = trpcClient.workflow.stream.subscribe(
				{
					requirement: requirement.trim(),
					auto,
					authz,
					cw: cwd.trim() || undefined,
					mode,
					repoBase: repoBase.trim() || undefined,
					workspace: workspace.trim() || undefined,
				},
				{
					onData(chunk) {
						handleChunk(chunk);
					},
					onError(err) {
						setError(err.message);
						appendLog("error", err.message);
						setIsRunning(false);
					},
					onComplete() {
						appendLog("info", "Workflow completed");
						setStatus("Completed");
						setProgress(prev => (prev < 100 ? 100 : prev));
						setIsRunning(false);
					},
				},
			);

			subscriptionRef.current = unsubscribe;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to start workflow";
			setError(message);
			appendLog("error", message);
			setIsRunning(false);
		}
	}

	function handleChunk(chunk: unknown) {
		const event = chunk as Record<string, unknown> | null;
		const type = (event?.type as string | undefined) ?? "unknown";

		switch (type) {
			case "progress": {
				const pct = typeof event?.pct === "number" ? event.pct : undefined;
				if (typeof pct === "number") {
					setProgress(prev => (pct > prev ? pct : prev));
				}
				if (typeof event?.message === "string") {
					appendLog("progress", event.message);
				}
				break;
			}
			case "stdout": {
				const text = getTextPayload(event);
				if (text) appendLog("stdout", text);
				break;
			}
			case "stderr": {
				const text = getTextPayload(event);
				if (text) appendLog("stderr", text);
				break;
			}
			case "droid": {
				const payload = event?.chunk ?? event?.data ?? event;
				appendLog("droid", JSON.stringify(payload));
				break;
			}
			case "notice": {
				const baseMessage =
					typeof event?.message === "string" ? event.message : JSON.stringify(event);
				const moduleId = typeof event?.module === "string" ? event.module : null;
				const taskId = typeof event?.task === "string" ? event.task : null;
				const error = typeof event?.error === "string" ? event.error : null;
				const scoped = moduleId
					? `module ${moduleId}${taskId ? ` task ${taskId}` : ""}: ${baseMessage}`
					: baseMessage;
				const message = error ? `${scoped} (${error})` : scoped;
				appendLog("notice", message);
				break;
			}
			case "data-cache-handoff": {
				const key = event?.key as readonly unknown[] | undefined;
				if (key) {
					queryClient.setQueryData(key, event?.value);
					appendLog("cache", `Cache handoff for key: ${JSON.stringify(key)}`);
				}
				break;
			}
			default: {
				appendLog(type, JSON.stringify(event));
				break;
			}
		}
	}

	function getTextPayload(event: Record<string, unknown> | null | undefined) {
		if (!event) return "";
		if (typeof event.text === "string") return event.text;
		if (typeof event.data === "string") return event.data;
		return "";
	}

	function handleStop() {
		stopCurrentSubscription();
		setIsRunning(false);
		setStatus("Stopped");
		appendLog("info", "Workflow stopped by user");
	}

	return (
		<div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold">Orchestrator Run Viewer</h1>
				<p className="text-muted-foreground text-sm">
					Start a plan workflow, stream logs in real time, and exercise token elevation for
					droid executions.
				</p>
			</header>

			<form onSubmit={handleStart} className="space-y-4">
				<div className="grid gap-2">
					<label className="text-sm font-medium" htmlFor="requirement">
						Requirement
					</label>
					<textarea
						id="requirement"
						className="min-h-[120px] w-full rounded border border-input bg-background px-3 py-2 text-sm"
						value={requirement}
						onChange={(event) => setRequirement(event.target.value)}
						placeholder="Describe the task for the orchestrator..."
						required
					/>
				</div>

				<div className="grid gap-2 md:grid-cols-2">
					<div className="grid gap-2">
						<label className="text-sm font-medium" htmlFor="auto">
							Autonomy Level
						</label>
						<select
							id="auto"
							className="h-10 rounded border border-input bg-background px-3 text-sm"
							value={auto}
							onChange={(event) => setAuto(event.target.value as AutoLevel)}
						>
							{autoLevels.map(level => (
								<option key={level} value={level}>
									{level}
								</option>
							))}
						</select>
					</div>
					<div className="grid gap-2">
						<label className="text-sm font-medium" htmlFor="cwd">
							Working Directory (optional)
						</label>
						<input
							id="cwd"
							type="text"
							className="h-10 rounded border border-input bg-background px-3 text-sm"
							value={cwd}
							onChange={(event) => setCwd(event.target.value)}
							placeholder="/srv/alfred"
						/>
					</div>
				</div>

				<div className="grid gap-2 md:grid-cols-3">
					<div className="grid gap-2">
						<label className="text-sm font-medium" htmlFor="mode">
							Execution Mode
						</label>
						<select
							id="mode"
							className="h-10 rounded border border-input bg-background px-3 text-sm"
							value={mode}
							onChange={(event) => setMode(event.target.value as "sequential" | "parallel")}
						>
							<option value="sequential">Sequential</option>
							<option value="parallel">Parallel (experimental)</option>
						</select>
					</div>
					<div className="grid gap-2">
						<label className="text-sm font-medium" htmlFor="repoBase">
							Base Ref
						</label>
						<input
							id="repoBase"
							type="text"
							className="h-10 rounded border border-input bg-background px-3 text-sm"
							value={repoBase}
							onChange={(event) => setRepoBase(event.target.value)}
							placeholder="origin/main"
						/>
					</div>
					<div className="grid gap-2">
						<label className="text-sm font-medium" htmlFor="workspace">
							Linear Workspace (optional)
						</label>
						<input
							id="workspace"
							type="text"
							className="h-10 rounded border border-input bg-background px-3 text-sm"
							value={workspace}
							onChange={(event) => setWorkspace(event.target.value)}
							placeholder="org-id"
						/>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<button
						type="submit"
						disabled={!canStart}
						className="inline-flex h-9 items-center justify-center rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
					>
						{isRunning ? "Running..." : "Start plan"}
					</button>
					<button
						type="button"
						onClick={handleStop}
						disabled={!isRunning}
						className="inline-flex h-9 items-center justify-center rounded border border-input px-4 text-sm font-medium disabled:opacity-50"
					>
						Stop
					</button>
					<div className="text-sm text-muted-foreground">
						Progress: {Math.round(progress)}%
						{status ? ` · ${status}` : null}
					</div>
				</div>

				{auto === "medium" || auto === "high" ? (
					<p className="text-xs text-muted-foreground">
						Medium/high autonomy requires passkey verification. You will be prompted automatically when
						the run starts.
					</p>
				) : null}
			</form>

			{error ? (
				<div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</div>
			) : null}

			<section className="space-y-2">
				<header className="flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
						Stream Output
					</h2>
				</header>
				<div
					ref={logContainerRef}
					className="h-80 w-full overflow-y-auto rounded border border-input bg-background p-3 text-sm font-mono"
				>
					{logs.length === 0 ? (
						<p className="text-muted-foreground">No output yet. Start a run to view logs.</p>
					) : (
						<ul className="space-y-1">
							{logs.map((entry) => (
								<li key={entry.id}>
									<span className="text-muted-foreground">[{entry.type}]</span> {entry.message}
								</li>
							))}
						</ul>
					)}
				</div>
			</section>
		</div>
	);
}
