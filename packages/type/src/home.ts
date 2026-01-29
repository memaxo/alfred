/**
 * Home Domain Taxonomy
 *
 * Pillars:
 * 1. network: Security, connectivity, and node runtime (Tailscale, Proxmox, Docker)
 * 2. media: AI curation of "Arr" stack (Sonarr, Radarr, Plex)
 * 3. security: Physical safety reasoning (Frigate, Cameras, Locks)
 * 4. presence: Biological context (Life360, Fi animal trackers)
 * 5. utility: Resource and maintenance (Energy, HVAC, Sensors)
 */

export type HomePillar =
  | "network"
  | "media"
  | "security"
  | "presence"
  | "utility";

export type HomeSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface HomeEntity {
  id: string;
  pillar: HomePillar;
  domain: string;
  name: string;
  state: string;
  attributes: Record<string, unknown>;
  confidence?: number;
  provider: string;
  updatedAt: Date;
}

export interface HomeEvent {
  id: string;
  entityId: string;
  pillar: HomePillar;
  type: string;
  severity: HomeSeverity;
  message: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface HomeAction {
  entityId: string;
  service: string;
  data?: Record<string, unknown>;
}

export interface HomeActionResult {
  success: boolean;
  entityId: string;
  state?: string;
  error?: string;
}
