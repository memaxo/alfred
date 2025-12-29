# Python Subprocess Patterns

## Core Principle

Python processes use stdin/stdout for IPC. stderr pipes to console. UV/virtualenv manage dependencies. JSON lines serialize messages.

## Rules

1. **Python executable resolution.** Prefer `uv run python`. Fall back to `.venv/bin/python` or `python3`. Resolve via `resolvePythonExecutable()`.

2. **UV integration.** Use `uv run` when `VOICE_USE_UV` ≠ "false". UV manages virtual environment automatically. Skip dependency verification when using uv.

3. **Dependency verification.** Skip verification when using uv run. Otherwise import-check nemo.collections.asr, silero_vad, numpy, transformers, snac, soundfile.

4. **IPC protocol.** Send JSON lines via stdin: `JSON.stringify(request) + "\n"`. Read JSON lines from stdout. Parse with `JSON.parse`.

5. **Request/Response types.** Use `IPCRequest` `{ id, type, payload? }`. Use `IPCResponse` `{ id, type, payload?, isFinal? }`. Include `crypto.randomUUID()` for request IDs.

6. **Bridge timeout.** Use `Bridge` class with `requestTimeout` default 10s. Send request via `ipc.sendRequest()`. Reject on timeout.

7. **Partial responses.** Use `isFinal: false` for streaming. Reset timeout on partial responses. Call `onPartial(response)` callback.

8. **stderr pipeline.** Read stderr ReadableStream with decoder. Write to `process.stderr` for visibility. Catch and ignore read errors.

9. **Exit code handling.** Check `await proc.exited` for exit status. Exit 124 = timeout, 127 = command not found.

10. **NumPy sanitization.** Sanitize NumPy types before JSON output. Convert `numpy.ndarray` to list. Convert `numpy.float64` to float.

## See Also

- `.ruler/process-pools.md` for pool lifecycle
