# Process Pool Patterns

## Core Principle

Voice pools manage persistent Python subprocesses. Registries track sessions. Cleanup interval removes idle sessions.

## Rules

1. **Registry lifecycle.** Create `VoiceRegistry` with STT and TTSPool instances. Call `startCleanup()` in constructor. Call `shutdown()` in application teardown.

2. **Session management.** Call `createSession(userId, sessionId, language?)` for new sessions. Call `removeSession(sessionId)` for cleanup. Call `getSession(sessionId)` to retrieve.

3. **Idle cleanup.** Cleanup interval runs every 60 seconds. Remove sessions idle > 5 minutes. Call `session.isIdle(timeoutMs)` for detection.

4. **Pool health tracking.** Track pool size, active count, utilization. Use `pool.getHealth()` for health status. Return `size`, `active`, `utilization`, `health`.

5. **Process spawning.** Use `Bun.spawn` with array format: `[command, ...args]`. Set `stdin: "pipe"`, `stdout: "pipe"`, `stderr: "pipe"`.

6. **Auto-restart.** Restart crashed processes in exit handler after 1000ms delay. Use `.unref()` on restart timer. Skip restart during shutdown.

7. **Graceful shutdown.** Send shutdown request before `process.kill()`. Send `"shutdown"` type request via IPC. Call `process.kill()` after 2s timeout.

8. **Health checks.** Ping processes every 30 seconds. Track last ping timestamp. Mark unhealthy when no ping > 60s.

## See Also

- `.ruler/python-subprocess.md` for IPC and subprocess details
