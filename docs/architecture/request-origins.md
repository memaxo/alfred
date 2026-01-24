# Request Origins

Owner: auth

ALFRED serves both browser and non-browser clients (Expo / native / CLIs). Browser-origin security primitives (like `Origin` and `Referer`) do not map cleanly to non-browser transports, but the backend still needs deterministic, auditable behavior when origin validators (e.g., Better Auth) are strict.

## Goals

- Preserve strict origin checks for **web** traffic.
- Support **native** traffic without weakening web security.
- Make debugging origin failures possible without mutating response bodies.
- Keep the pattern repeatable across routes and services.

## Principles

- **Browser-only semantics**: `Origin` and `Referer` are authoritative only for real browsers.
- **Explicit non-browser metadata**: non-browser clients send origin-like data in a dedicated header (e.g. `expo-origin`), never by faking `Origin`.
- **Normalization at the boundary**: normalize once, at the server route boundary, before forwarding to downstream validators.
- **Debug via headers**: attach diagnostics as response headers in non-production to avoid consuming or rewriting response bodies.

## Canonical Pattern

### 1) Accept a dedicated origin header

Use a separate header (e.g. `expo-origin`) for native origin-like context.

### 2) Normalize aggressively

Normalize to the smallest stable representation that downstream validators expect:

- **Deep link schemes**: collapse to scheme origin (e.g. `alfred://--/` → `alfred://`).
- **Expo schemes**: collapse `exp://...` and `expo://...` to scheme origin.
- **HTTP(S)**: parse and use `URL.origin` to drop path/query noise.
- **Fallback**: if parsing fails, keep the raw string but treat it as diagnostic, not security-critical.

### 3) Forward a “clean” request

When the request is coming from a non-browser client:

- delete `origin` and `referer` (they’re usually misleading in native stacks)
- reattach the normalized `expo-origin`
- pass the new `Request` into the downstream handler

### 4) Debug without rewriting bodies

In non-production and for 4xx responses, attach diagnostic headers:

- `x-alfred-origin`
- `x-alfred-expo-origin`
- `x-alfred-expo-origin-normalized`

This keeps the response body untouched (important for typed clients and streaming bodies).

## Failure Modes This Prevents

- **Hook/SDK mismatch**: native stacks emitting non-browser `Origin` values that strict validators reject.
- **Non-deterministic debugging**: body rewrites that change error payloads, break JSON parsing, or consume streams.
- **Security regression**: relaxing origin checks globally instead of scoping the workaround to non-browser requests.
