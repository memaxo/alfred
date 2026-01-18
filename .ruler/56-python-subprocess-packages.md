# Python Subprocess Packages

## Core Pattern

When TypeScript needs ML capabilities (embeddings, perplexity, speech), use a Python subprocess with JSON-RPC over stdin/stdout.

## Rules

1. **Directory structure.** Place Python code in `python/` subdirectory with `__init__.py`, `server.py` (JSON-RPC handler), and implementation modules.

2. **Dependencies.** Use `pyproject.toml` with `uv` for Python dependency management. Commit `uv.lock` for reproducibility.

3. **Server protocol.** Python server reads JSON lines from stdin, writes JSON lines to stdout. Each message has `id`, `type`, and `payload` fields.

4. **Ready signal.** Server must emit `{"type": "ready", "id": "init"}` after model loading completes. TypeScript waits for this before processing requests.

5. **Process class.** Create `src/process.ts` with: `start()`, `shutdown()`, request methods, health monitoring, and pending request tracking with timeouts.

6. **Graceful degradation.** Export `isPythonAvailable()` that checks both env var override AND system capabilities (`which uv`, `which python3`).

7. **Heuristic fallback.** Every API function must have a pure-TypeScript fallback. Return identical types regardless of backend; include `metadata.method` to indicate which was used.

8. **Offline mode.** Support `ALFRED_<PKG>_OFFLINE=1` env var to force heuristic fallback. Check this FIRST in `isPythonAvailable()`.

9. **Test separation.** Create two test files: `<pkg>.test.ts` for heuristic tests (fast, no deps), `python.test.ts` for integration tests (slower, requires `uv sync`).

10. **Model configuration.** Pass model name and device via env vars to Python process. Support `auto`, `cpu`, `cuda`, `mps` for device selection.

11. **Scripts.** Add `python:install` (`uv sync`) and `python:check` scripts to `package.json` for dependency management.

12. **Timeout budget.** Model loading can take 30-300 seconds. Set generous `waitForReady` timeout. Subsequent requests should be fast (<1s).

## Reference Implementations

- `@alfred/embed` - Embedding models with KaLM/Qwen
- `@alfred/voice` - Speech-to-text with Whisper
- `@alfred/summarize` - LongCodeZip compression
