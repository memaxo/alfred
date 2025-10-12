# Streaming & Scheduling

1. **Schedulers.** Export `start<Domain>Scheduler` functions and keep them idempotent. Callers decide when to start based on env flags.
2. **Intervals.** Introduce jitter (> zero) to avoid synchronized wake-ups. Document limitations for multi-instance deployments.
3. **tRPC streams.** When adding streaming procedures, surface an incremental payload (`{ type: "data" | "error" | "done" }`). Keep payloads JSON serialisable.
4. **Notifications.** Record fired reminders and timers through repos before emitting events downstream (websocket, SSE, etc.).
