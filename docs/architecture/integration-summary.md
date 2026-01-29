# ALFRED Integration Status Summary

**Quick Reference**: See [integration-audit.md](./integration-audit.md) for full details.

## What's Wired Together ✅

**Core Execution Stack** (17 packages):

- Runtime → Cognitive, Knowledge, Learning, Policy, Agent, Plan
- API → Runtime + Pipeline
- Apps → API (via tRPC)
- DB → All packages (via repos)

**Well-Integrated Packages:**

- Domain: `cognitive`, `knowledge`, `learning`, `policy`, `agent`, `plan`
- Infrastructure: `db`, `auth`, `rag`, `embed`, `rerank`, `voice`
- Execution: `runtime`, `pipeline`
- Shared: `type`, `logger`, `metrics`
- Tools: `codeprint` (via plan research)

## What's Not Wired ⚠️

**Partially Integrated** (7 packages):

- `sense` - Native voice capture is wired; photo capture + a few flows still pending
- `graph` - Overlaps with `knowledge` but boundaries are now documented
- `history` - Lightweight, minimal usage
- `persona` - Client-only (web app)
- `ui` - Native-only
- `pacer` - Not used in core runtime
- `summarize` - Intentionally standalone context-compression utility (allowed disconnected)
- `code-analysis` - Integrated via review router; only `raw_diff` supported

**Intentionally Standalone / Tooling / Client-only**:

- `cortex` - Client-only rendering engine + presets; referenced by web + API visual helpers
- `tune` - Tooling service exposed via API router (not wired into learning loops by default)
- `protocol` - Core shared protocol schemas (agent + clients)
- `mcp` - Core runtime MCP integration surface (gated by env)
- `harbor` - Tooling for trajectory inspection (scripts)
- `tui` - Tooling UI (terminal mode + scripts)

## Critical Issues

1. **Pipeline vs Runtime Duplication**
   - Two execution paths: Pipeline (8 stages) vs Runtime (4 phases)
   - Both used by API but unclear when to use which
   - **Action**: Document decision tree or consolidate

2. **Graph vs Knowledge Overlap**
   - `knowledge` = in-memory hypergraph
   - `graph` = DB query layer
   - **Action**: Clarify boundaries or consolidate

3. **Sense → Native Gap**
   - Sense package exists but native capture doesn't call it
   - **Action**: Wire `apps/native/lib/voice/capture.ts` → `trpc.capture.create.mutate()`

## Immediate Actions

### This Week

1. **Audit unused packages**:
   - [x] `@alfred/resilience` - Integrated into pipeline runner safeguards
   - [x] `@alfred/code-analysis` - Integrated into review router (raw diff analysis)
   - [x] `@alfred/util` - Deleted (package no longer exists)

2. **Document disconnected packages**:
   - [x] Document boundaries in `docs/architecture/integration-audit.md` (no new READMEs required)

### This Month

3. **Complete Sense integration**:
   - [x] Wire native capture → sense routers (voice capture)
   - [x] Test capture → inbox → triage flow

4. **Clarify Pipeline vs Runtime**:
   - [ ] Document when to use which
   - [ ] Add decision tree to architecture docs

5. **Clarify Graph vs Knowledge**:
   - [ ] Document separation or consolidate

## Integration Health Score

**57% fully integrated** | **23% partial** | **30% disconnected**

**Target**: 80% fully integrated, 15% partial, 5% disconnected

---

**Full Audit**: See [integration-audit.md](./integration-audit.md)  
**50 Recommendations**: See [integration-recommendations.md](./integration-recommendations.md)
