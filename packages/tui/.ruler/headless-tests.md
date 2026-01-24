# Headless TUI Tests

1. **No hanging stdin.** Any headless loop must exit promptly when `stdin` closes; always listen for `"end"` and `"close"` and stop the loop.
2. **Output assertions.** When headless output is required for assertions, prefer in-process capture (patching `process.stdout.write`) over spawned-process piping.
3. **Fast headless.** Tests must set `ALFRED_TUI_HEADLESS_MS` low (≤ 250ms) and avoid relying on interactive key sequences for quit paths.
4. **Keep timers unref’d.** Any headless polling interval must call `.unref()` so `bun test` can exit.
