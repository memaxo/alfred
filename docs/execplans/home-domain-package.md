# ExecPlan: @alfred/home Domain Package

Owner: home

## Purpose

Consolidate and expand ALFRED's "Home" capabilities from simple device control to full **"Living Space Autonomy."** This domain orchestrates network security, media curation, physical security reasoning, and family/pet presence.

## Pillars

1.  **Network (Security & Runtime):** Guarding the digital perimeter and ALFRED's infrastructure (Tailscale, Proxmox, Unifi).
2.  **Media (Arr Curation):** AI-driven management of the "Arr" media stack (Sonarr, Radarr, etc.).
3.  **Security (Physical Reasoning):** Understanding events from cameras and locks (Frigate, Scrypted, Home Assistant).
4.  **Presence (Family & Animals):** Geofence-based context (Life360, Fi animal tracker).

## Architecture

### 1. Unified Types (`@alfred/type/src/home.ts`)

Define a schema that generalizes "Home Entities" across all pillars:

```typescript
export type HomePillar =
  | "network"
  | "media"
  | "security"
  | "presence"
  | "utility";

export interface HomeEntity {
  id: string; // "presence.life360.user_a"
  pillar: HomePillar;
  domain: string; // "person", "camera", "router", "series"
  state: string; // "home", "away", "recording", "online", "missing"
  attributes: Record<string, unknown>;
  confidence?: number; // AI-inferred states (e.g. intruder detection)
}
```

### 2. Domain Package (`@alfred/home`)

A new package that encapsulates pillar-specific clients and unified orchestration.

- `packages/home/src/network/`: Tailscale/Proxmox integration.
- `packages/home/src/media/`: Sonarr/Radarr clients.
- `packages/home/src/security/`: Camera event reasoning (LLM-based classification).
- `packages/home/src/presence/`: Life360/Fi data normalization.

### 3. Database Schema (`@alfred/db/src/schema/home.ts`)

- `home_entities`: Cache for all discovered entities.
- `home_events`: Time-series of significant home events (e.g. "Unrecognized person at door").
- `home_preferences`: Learned behaviors (e.g. "Sir prefers the house at 72°F when home").

## Plan

### Phase 1: Scaffolding & Types

- [x] Create `@alfred/home` package structure.
- [x] Define `HomeEntity` and related types in `@alfred/type`.
- [x] Add Zod schemas in `@alfred/type/src/home.zod.ts`.
- [x] Implement `packages/db/src/schema/home.ts` for caching and event storage.
- [x] Register `@alfred/home` in root `tsconfig.json` references and `@alfred/tsconfig` paths.

### Phase 2: Pillar Migration

- [x] Extract `packages/agent/src/lib/homeassistant.ts` implementation into `packages/home/src/security/homeassistant.ts` and re-export for compatibility.
- [x] Extract `packages/agent/src/lib/proxmox.ts` implementation into `packages/home/src/network/proxmox.ts` and re-export for compatibility.
- [x] Extract `packages/api/src/tailscale/status.ts` implementation into `packages/home/src/network/tailscale.ts` and re-export for compatibility.

### Phase 3: New Integrations

- [x] Scaffold `Sonarr`/`Radarr` clients in `packages/home/src/media/`.
- [x] Scaffold `Life360`/`Fi` clients in `packages/home/src/presence/`.
- [ ] Implement "Intruder Detection" reasoning logic using `gpt-oss-120b` for camera event classification.

### Phase 4: Entry Point Refactoring

- [x] Refactor `homeRouter` in `packages/api` to use `@alfred/home` when configured (falls back to in-memory state when not).
- [x] Refactor `home` tool in `packages/agent` to consume the `@alfred/home` Home Assistant client via the legacy re-export.
- [x] Add `home.act` scope to policy system for impactful operations (Lock/Unlock, Delete Media).

## Progress

- 2026-01-27: Phase 1 scaffolding landed: `@alfred/type` home types + Zod schemas, `@alfred/db` home schema, and `@alfred/home` package registered for composite typecheck.
- 2026-01-27: Phase 2 partial migration landed: Proxmox + Home Assistant clients and Tailscale probe extracted into `@alfred/home` with legacy re-exports preserved.
- 2026-01-27: Phase 3 scaffolding landed: Sonarr/Radarr media clients + Life360/Fi presence clients (no API routing wired yet).

## Decision Log

- **Single Domain:** Use one `home` domain rather than splitting into `network`, `media`, etc., to provide a unified "Living Space" context for the AI.
- **Provider Abstraction:** All external APIs must be abstracted behind a standard `HomeProviderClient` interface.
- **Cognitive Integration:** "Security" actions (Locks/Alarms) will require higher autonomy (0.9) than "Media" actions (0.4).
- **Types vs schemas:** Keep runtime schemas in `home.zod.ts` and pure types in `home.ts` (matches existing `voice.ts` + `voice.zod.ts` pattern).

## Outcomes & Retrospective

_(To be populated after implementation)_
