# Voice Admin Dashboard ExecPlan

This ExecPlan is a living document maintained per `.agent/PLANS.md`. Every section must stay up to date so a newcomer can finish the effort without outside context.

## Purpose / Big Picture

Deliver a secure `/admin/voice` dashboard that surfaces real-time Voice pool health and exposes vetted recovery actions. Administrators should be able to confirm pool status at a glance, inspect latency trends, and restart pools safely when saturation or crashes occur.

## Progress

- [x] (2025-11-24 18:05Z) `packages/api/src/routers/admin.ts` now exposes `getVoiceStats` and `restartVoicePool`, guarded by `requireRecentBiometric` so only biometric-elevated sessions can call them.
- [x] (2025-11-24 20:12Z) Added telemetry aggregation (`collectVoiceTelemetry`) so `getVoiceStats` returns latency/jitter/packet-loss summaries alongside pool registry data.
- [x] (2025-11-24 20:25Z) Built the `/admin/voice` route with refreshed status cards, pool visualizations, telemetry panel, and biometrics-aware empty states.
- [x] (2025-11-24 20:25Z) Wired restart and clear-session controls with optimistic UI + toast feedback using the new admin mutations.
- [ ] (Remaining) Add sparkline charts sourced from Prometheus samples (current UI shows summarized cards only).

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Use biometric elevation (recent passkey) instead of a generic `requireElevated` flag for admin controls.
  Rationale: Aligns with token router precedent and ensures restart actions cannot be triggered by stale elevated sessions.
  Date/Author: 2025-11-24 / Codex Agent.

## Outcomes & Retrospective

- Pending.

## Implementation Plan

### Phase 1: API Metrics Exposure (IN PROGRESS)

1. **Stats payload parity** (remaining): augment `getVoiceStats` so, beyond `voiceRegistry.getStats()`, it also reports latency percentiles, packet loss, and recent error counts. Source data from Prometheus metrics or a lightweight in-memory accumulator inside `voiceRegistry`.
2. **Session clearing hook** (remaining): expose a `clearSessions` mutation beside `restartVoicePool` so UI controls can evict stale registries without restarts (optional stretch).

### Phase 2: Dashboard UI (`apps/web`) (NOT STARTED)

1. Create `/admin` layout plus `/admin/voice` route with route guard that verifies the biometric-elevated session flag before rendering.
2. Implement status cards for overall health, active sessions, STT saturation, and TTS saturation using TanStack Query polling every ~3s.
3. Draw pool visualizations (grid or list) using SVG/Canvas to represent process state (Idle/Active/Dead) and include uptime + restart counters.
4. Render latency charts (sparkline of RTT + processing time) fed by metrics arrays in the API response.

### Phase 3: Control Actions (NOT STARTED)

1. Add "Restart Pool" and "Clear Sessions" buttons that call the admin router mutations; require biometric confirmation in UI if `FORBIDDEN` is returned.
2. Display confirmation/toast plus optimistic UI state (e.g., show pool restarting spinner until stats refresh indicates success).

## Technical Considerations

- **Polling**: Use TanStack Query `refetchInterval` 2000 ms with background refetch disabled to avoid stale state when tab hidden.
- **Security**: Surface biometric status in the session context so the UI can prompt the operator to re-verify before invoking actions.
- **Dependencies**: Prefer existing charting primitives (e.g., `@alfred/ui` sparklines) before pulling in `recharts`; only add new libs if necessary.

## Success Metrics

- Dashboard initial load (API + UI) completes within 200 ms on LAN.
- Stats update within 3 s of pool restarts or new sessions starting.
- Restart/Clear actions succeed consistently and log audit events.

## Revision Note

- (2025-11-24) Updated progress to reflect biometric-protected admin router that already exists, clarified remaining API work, and reoriented the plan toward UI delivery to eliminate conflicts with the current implementation.
