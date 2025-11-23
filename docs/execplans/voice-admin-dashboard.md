# Voice Admin Dashboard ExecPlan

## Purpose
Create a real-time dashboard to monitor the health, performance, and utilization of the Voice architecture. This provides visibility into process pool saturation, session latency, and model errors.

## User Story
As an administrator, I want to see:
- How many voice sessions are active.
- If the STT/TTS process pools are healthy or saturated.
- Real-time latency metrics (RTT, Processing Time).
- Recent errors to quickly diagnose issues.

## Implementation Plan

### Phase 1: API Metrics Exposure
- [ ] Create `admin` tRPC router in `packages/api`.
- [ ] Expose `getVoiceStats` procedure:
  - Active sessions count (from Registry).
  - Pool status (active/total processes, health).
  - Aggregated metrics (p95 latency, packet loss rate).
- [ ] Secure route with `requireElevated` (or similar admin check).

### Phase 2: Dashboard UI (`apps/web`)
- [ ] Create `/admin` layout and `/admin/voice` route.
- [ ] Implement **Status Cards**:
  - System Health (Green/Red).
  - Active Sessions.
  - GPU/Memory Usage (if available via system stats).
- [ ] Implement **Pool Visualization**:
  - Visual grid of STT/TTS processes (Active/Idle/Dead).
  - Uptime and restart counters.
- [ ] Implement **Latency Charts**:
  - Simple sparklines for RTT and Processing Time.

### Phase 3: Control Actions
- [ ] Add "Restart Pool" button (force kill/respawn).
- [ ] Add "Clear All Sessions" button.

## Technical Considerations
- **Polling**: Use `useQuery` with 2-5s refetch interval for "real-time" feel without socket overhead.
- **Security**: Ensure only authorized users can access (local-only or auth-gated).
- **Dependencies**: `recharts` or `visx` for charts (check if already installed).

## Success Metrics
- Dashboard loads in < 200ms.
- accurately reflects state changes (e.g., starting a session updates the count).
- "Restart Pool" successfully recovers a stuck state.
