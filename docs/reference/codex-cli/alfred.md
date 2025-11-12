# Using Codex with Alfred

The Alfred orchestrator can swap the default droid executor for the Codex CLI while keeping the same policy gates and observability. This page captures the knobs you need in addition to the upstream Codex docs.

## Authentication

- Prefer `CODEX_API_KEY` for headless runs. Export it alongside other agent secrets or add it to `.env`.
- Leave `ORCH_CODEX_ALLOW_OPENAI_KEY=1` (default) when you want the orchestrator to fall back to `OPENAI_API_KEY` automatically. Set it to `0` to block that pass-through during audits.
- `CODEX_PROFILE` lets you target a named Codex profile (e.g., `alfred`) without editing per-run flags.

## Sandbox Mapping

Codex mirrors the droid autonomy levels to CLI sandbox flags:

- `read` → `--sandbox read-only` with approval `on-request`
- `low`/`medium`/`high` → `--sandbox workspace-write` with approval `on-request`

`ORCH_ALLOW_CWD_PREFIXES` still bounds the working directory; Codex reuses the same guard.

## Observability & Fallbacks

- Metrics: `codex_exec_runs_total{auto,exit_code}`, `codex_exec_duration_seconds{auto}`, `codex_errors_total{stage}`.
- Flip `ORCH_EXECUTOR=codex` to enable Codex, and keep `ORCH_EXECUTOR_FALLBACK=1` to auto-return to droid when spawn, timeout, or parse errors occur.
- For shadow testing, set `ORCH_EXECUTOR_SHADOW=1` so Codex runs in the background while droid results remain the source of truth.
- Backout is a single env flip: `ORCH_EXECUTOR=droid` (optionally with `ORCH_EXECUTOR_FALLBACK=1`).

## Troubleshooting

- **Missing binary** – set `CODEX_BIN` to the absolute path or install the CLI (`docs/codex-cli/install.md`).
- **Login required** – verify `CODEX_API_KEY`/`OPENAI_API_KEY` is present; the orchestrator surfaces `codex_login_required` errors when the CLI prompts for auth.
- **Sandbox mismatch** – medium/high autonomy still require recent biometric claims. The orchestrator throws `biometric_required` before spawning Codex if those claims are missing.
