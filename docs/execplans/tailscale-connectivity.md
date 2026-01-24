# tailscale-connectivity

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Enable a high-quality, secure “mobile → home server” connection for ALFRED by using Tailscale as the remote connectivity layer.

After this work, a novice user can:

1. Join their home ALFRED server and their phone to the same Tailscale tailnet (a private network managed by Tailscale).

2. Reach the ALFRED API over a stable, encrypted, identity-aware URL (preferably `https://<alfred-host>.<tailnet>.ts.net`) without opening router ports.

3. Configure the ALFRED mobile app to use that tailnet URL and see clear diagnostics (DNS/TLS/health) indicating whether the connection is working.

This ExecPlan targets ALFRED itself (this monorepo), not apps ALFRED generates for end users.

## Progress

- [ ] (2026-01-19 00:00Z) Write the connectivity guide and verify it end-to-end on a real tailnet (server + phone), capturing minimal proof transcripts.
- [x] (2026-01-19 00:00Z) Add a canonical “server base URL” concept for mobile (and optionally web), including robust detection of tailnet URLs and better connection diagnostics than substring heuristics.
- [x] (2026-01-19 00:00Z) Add an explicit “Tailscale connectivity” status surface in the UI that proves: DNS resolves, HTTPS works, and `/healthz` (or equivalent) returns 200.
- [x] (2026-01-19 00:00Z) Add tests for URL classification and connectivity diagnostics (unit tests), plus an env-gated integration check for a real tailnet URL (optional).
- [x] (2026-01-19 00:00Z) Document safe failure modes and fallback options (LAN URL, alternative hostnames), and ensure the mobile UI explains them clearly.

Additional integration hardening (done):

- [x] (2026-01-19 00:00Z) Make `integration.list()` report real Tailscale runtime status (installed/running/tailnet/DNS name) via `tailscale status --json`, and surface it in Settings → Integrations UI.

## Surprises & Discoveries

- Observation: In Bun, `new URL("http://[::1]").hostname` includes square brackets (e.g. `"[::1]"`), which breaks naive IPv6 hostname classification.
  Evidence: `bun -e 'console.log(new URL("http://[fd7a:115c:a1e0::1]:3000").hostname)'`

- Observation: Voice streaming URL resolution used `EXPO_PUBLIC_SERVER_URL` only; it needed a runtime base URL parameter to follow the Settings → Server override.
  Evidence: `apps/native/lib/voice/env.ts` + `apps/native/lib/voice/session.ts` now accept `baseUrl`.

## Decision Log

- Decision: Use Tailscale as a connectivity layer first; do not add automatic tailnet policy mutation in the initial implementation.
  Rationale: Connectivity can be delivered with no Tailscale API credentials and minimal risk; policy automation has higher lockout risk and needs a separate rollback story.
  Date/Author: 2026-01-19 / GPT-5.2

- Decision: Prefer tailnet HTTPS URLs (`*.ts.net`) over raw CGNAT IPs for user-facing configuration.
  Rationale: Hostnames are stable and readable; IPs are brittle (IPv6, routing changes) and lead to weak heuristics (“contains 100.”).
  Date/Author: 2026-01-19 / GPT-5.2

- Decision: Treat `EXPO_PUBLIC_SERVER_URL` as the default, but add a runtime override stored in app storage for real users.
  Rationale: A build-time-only base URL is fine for local dev but not for a real “mobile ↔ home server” product; users need to change servers without rebuilding the app.
  Date/Author: 2026-01-19 / GPT-5.2

- Decision: Normalize IPv6 hostnames by stripping `[` and `]` before tailnet classification.
  Rationale: Bun’s URL parser returns bracketed IPv6 hostnames; classification must be resilient across JS runtimes.
  Date/Author: 2026-01-19 / GPT-5.2

## Outcomes & Retrospective

(Write after completing a milestone or the full plan.)

## Context and Orientation

ALFRED is a self-hosted assistant with:

- A web/server app (`apps/web`) that serves the HTTP surface area that clients hit (health endpoints, metrics, tRPC, streaming endpoints).
- A server API router (`packages/api`) that defines the tRPC procedures, which are mounted and served by `apps/web` under `/api/trpc`.
- A mobile client (`apps/native`) that currently uses a build-time environment variable (`EXPO_PUBLIC_SERVER_URL`) as its server base URL and shows a simple “Connected via Tailscale” banner using a substring heuristic.

Current repo touchpoints relevant to this plan:

- `apps/native/app/(drawer)/index.tsx` now uses `GET /healthz` as a low-friction connectivity probe and classifies tailnet URLs without substring heuristics.
- `apps/native/app/(drawer)/(tabs)/settings/server.tsx` provides a runtime “Server URL” editor and a `/healthz` connectivity check.
- `apps/native/lib/server-url.ts` implements URL normalization + tailnet classification (`*.ts.net`, CGNAT IPv4, Tailscale IPv6 ULA prefix).
- `apps/native/lib/api.tsx` provides `ApiProvider`, which wires a runtime server URL into tRPC + Better Auth for the app.
- `apps/native/utils/trpc.ts` now exports a `createTrpcClient(baseUrl, getCookie)` factory (no global singleton client).
- `apps/native/hooks/use-chat-logic.ts` now uses the runtime server URL for streaming endpoints and conversation hydration.
- `apps/web/src/routes/healthz.ts` defines `GET /healthz` returning JSON `{ ok: true, ts: <ms> }` and `Cache-Control: no-store`.
- `apps/web/src/routes/healthz/deps.ts` defines `GET /healthz/deps` returning JSON `{ ok: true, redis: "ok" | "unavailable" }` (or HTTP 500 with `{ ok: false, error: <message> }`) and `Cache-Control: no-store`.
- `config/env.example` contains optional variables `TAILSCALE_API_KEY` and `TAILNET_NAME` (for potential future automation ideas), but the connectivity-first baseline should not require these.
- `packages/api/src/routers/index.ts` defines the tRPC router and includes a trivial `healthCheck` procedure returning `"OK"`.
- `packages/api/src/routers/integration.ts` exposes a stub “Tailscale integration” status that is currently just “enabled if env var exists”.

Terms used in this plan (define before use):

- Tailnet: A private network managed by Tailscale; devices joined to the tailnet can reach each other as if on the same LAN, with encryption and identity-based access control.
- MagicDNS: A Tailscale feature that provides stable names for tailnet devices; commonly used as a base for `*.ts.net` access.
- Tailscale Serve/HTTPS: A Tailscale feature that can publish a local service (like `http://127.0.0.1:3000`) as `https://<device>.<tailnet>.ts.net` with TLS termination handled by Tailscale. This keeps services private to the tailnet by default.
- Funnel: A Tailscale feature that intentionally exposes a service publicly on the internet. It is out of scope for the default “private connectivity” baseline.

Non-goals for the initial scope (explicitly out of scope unless a later milestone opts in):

- Editing the tailnet policy file via the Tailscale API (policy automation).
- Consuming Tailscale webhooks.
- Replacing Better Auth or ALFRED’s existing application-layer auth; Tailscale is transport/connectivity, not the application auth layer.

## Plan of Work

Milestone 1: Produce a copy-pasteable, novice-proof guide for “Tailscale as ALFRED connectivity layer”.

At the end of this milestone, a reader can follow `docs/guides/` documentation to:

- Install Tailscale on the ALFRED server host and sign in.
- Install/sign in on a phone.
- Confirm both are on the same tailnet.
- Publish ALFRED as tailnet HTTPS using Tailscale Serve/HTTPS (not Funnel).
- Configure ALFRED mobile to use the resulting tailnet URL.
- Verify success by observing a green health indicator and a successful API request.

Milestone 2: Make the mobile app’s Tailscale status and connectivity diagnostics correct and user-facing.

At the end of this milestone:

- The mobile app has a canonical “server base URL” and classifies it as one of:
  - Tailnet hostname (`*.ts.net`).
  - Tailnet IP (CGNAT range `100.64.0.0/10` and/or an IPv6 path).
  - Non-tailnet (public URL or LAN IP).
- The UI runs a deterministic connectivity check sequence and reports which step failed:
  - DNS resolution (when using a hostname).
  - HTTPS/TLS handshake.
  - ALFRED API health endpoint returns 200.
- The UI messaging clearly distinguishes “Tailscale is your network path” from “ALFRED authentication is your login”.

Milestone 3: Add a minimal server health endpoint suitable for mobile connectivity checks.

At the end of this milestone:

- We standardize on the existing `apps/web` HTTP endpoints as the canonical connectivity checks:
  - `GET /healthz` for “server is up and responding”.
  - `GET /healthz/deps` for “server dependencies are reachable” (DB and Redis).
- The mobile app’s connectivity UI uses `GET /healthz` as the first, lowest-friction probe because it does not require tRPC wiring or auth cookies.

Milestone 4: Testing and regression protection.

At the end of this milestone:

- URL classification is unit-tested (hostnames, IPv4 CGNAT, IPv6, malformed URLs).
- Connectivity checks are unit-tested as pure logic where possible (state machine of steps, error mapping).
- Any real-network integration test is explicitly opt-in via env vars and will not run in CI by default.

Milestone 5 (optional, explicitly gated): Automation exploration.

Only after connectivity is proven stable and observable, add an opt-in “generate tailnet policy snippet” helper:

- ALFRED generates grants-based policy snippets (not direct apply) for restricting access to ALFRED’s tailnet host/ports.
- Applying changes remains a user action in the Tailscale admin console or GitOps, not an automatic write from ALFRED.

## Concrete Steps

All commands below are intended to be run by a human operator on their own machines. This plan is self-contained; it does not assume prior Tailscale knowledge.

1. Prepare a tailnet and join devices
   - Install Tailscale on the home server host.
   - Install Tailscale on the phone.
   - Sign in to both with accounts that land them in the same tailnet.
   - Confirm both appear in the Tailscale admin console as online devices.

2. Publish ALFRED privately to the tailnet (HTTPS)
   - Start the ALFRED server (this repo’s `apps/web`) and confirm health endpoints respond locally.

     For local development (runs on port 3001):
     - From the repository root:
       - bun run dev:web
     - In another terminal:
       - curl -sS http://localhost:3001/healthz
       - curl -sS http://localhost:3001/healthz/deps

     For production deployments, follow `docs/guides/deployment.md`. The guide assumes ALFRED serves on port 3000 and the canonical health checks are:
     - curl http://<alfred-ip>:3000/healthz
     - curl http://<alfred-ip>:3000/healthz/deps

   - Configure Tailscale “Serve” to publish the local ALFRED HTTP port over tailnet HTTPS.

     This plan does not rely on Funnel (public exposure). The goal is: the service is reachable only from tailnet devices.

     Example workflow on the ALFRED server host:
     - tailscale status
     - tailscale serve https / http://127.0.0.1:3000
     - tailscale serve status

     Rollback / recovery:
     - tailscale serve reset

   - Confirm the resulting `https://<device>.<tailnet>.ts.net/healthz` URL is reachable from the phone while Tailscale is connected.

3. Configure ALFRED mobile
   - Configure the mobile app to use the tailnet HTTPS URL as its server base URL.

     For development builds today, the base URL is `EXPO_PUBLIC_SERVER_URL`:
     - Create `apps/native/.env` (copy from `apps/native/.env.example`) and set:
       - EXPO_PUBLIC_SERVER_URL=https://<device>.<tailnet>.ts.net
     - Start the native app from the repo root:
       - bun run dev:native

     The implementation work in this plan will add a runtime-configurable base URL UI so end users can change servers without rebuilding.

   - Confirm the app shows:
     - “DNS OK” (if hostname).
     - “TLS OK”.
     - “ALFRED health OK”.

4. Capture evidence into the plan
   - Include short, anonymized example transcripts demonstrating:
     - The configured base URL form.
     - A successful health check.
     - A failed check case and the UI’s error messaging.

## Validation and Acceptance

Acceptance is defined as user-visible behavior that a novice can verify:

- From a phone on the tailnet, opening the configured ALFRED base URL reaches the ALFRED server over HTTPS without exposing public ports.
- From any tailnet device, `GET /healthz` returns HTTP 200 with JSON containing `{ ok: true }` and `Cache-Control: no-store`.
- From the ALFRED mobile app:
  - The server status panel shows a passing health check when Tailscale is connected.
  - If Tailscale is disabled on the phone, the app clearly reports that the tailnet path is unavailable (and does not mislabel the server).
- For developers:
  - Running the relevant test command(s) succeeds, and the new unit tests cover the tailnet URL classification logic.

## Idempotence and Recovery

The setup steps must be repeatable without harm:

- Re-running “serve/https” configuration steps should either be no-ops or clearly instruct how to remove/replace the serve config.
- If a misconfiguration occurs, the recovery path must be documented in the guide:
  - Disable Serve and confirm local-only ALFRED still works.
  - Re-enable Serve and re-run connectivity checks.

## Artifacts and Notes

This plan intentionally avoids embedding secrets.

When implementation begins, capture minimal proof snippets here (indented, no nested code fences), for example:

    Example: Mobile base URL configured as https://alfred-home.example.ts.net
    Example: GET /healthz returns HTTP 200 with body OK

## Interfaces and Dependencies

Connectivity-first implementation should not add new third-party dependencies unless strictly necessary.

If a new “URL classification” helper is introduced, it must be a pure function that:

- Accepts a string base URL.
- Returns a small tagged result describing whether it is a tailnet hostname, tailnet IP, or non-tailnet URL.
- Provides a human-readable reason for UI display (e.g., “hostname ends with .ts.net” or “IPv4 in 100.64.0.0/10”).
