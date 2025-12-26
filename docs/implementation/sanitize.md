# sanitize

Purpose: Document the current threat model and tradeoffs for `sanitizeContextText` in `@alfred/db`.

## Scope

- **Targets ALFRED itself**: this is server-side sanitization used when persisting and reusing snippets in prompts (learning context, graph labels/properties).
- **Not a UI HTML sanitizer**: UIs must still escape/untrusted-render correctly.

## Threat model

- **Prompt injection**: past execution snippets can contain instruction-like text or delimiters that confuse downstream prompting.
- **XSS-ish input contamination**: snippets may contain HTML/JS payloads; we want to avoid storing them verbatim as “context”.
- **ReDoS**: sanitization must be bounded and fast even on very large inputs.

## Current implementation

`packages/db/src/repo/sanitize.ts`:

- Caps input before any scanning to bound runtime.
- Strips HTML tags and comments via a small linear scanner (no external dependency).
- Removes known delimiter tokens and common injection phrases via case-insensitive substring removal (no regex backtracking).
- Normalizes whitespace and clamps to `MAX_SANITIZED_LENGTH`.

## Library evaluation (follow-up)

If we want stronger, standards-based HTML sanitization (handling malformed markup, entities, edge-case bypasses), evaluate:

- **sanitize-html** (Node/server): strong allowlist model; good fit for server-only packages.
- **DOMPurify** (browser): for Node requires `jsdom`, heavier operational footprint.

Decision: keep the current dependency-free approach for now (fast + bounded), revisit if we start rendering stored context as HTML or see bypasses in the wild.

