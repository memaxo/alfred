/**
 * Home Assistant API Client
 *
 * Provides integration with Home Assistant's REST API for home automation control.
 *
 * Key Endpoints:
 * - GET /api/states - Get all entity states
 * - GET /api/states/<entity_id> - Get single entity state
 * - POST /api/services/<domain>/<service> - Call a service
 * - GET /api/config - Get configuration
 *
 * Required Environment:
 * - HOME_BASE_URL: Home Assistant instance URL (e.g., http://homeassistant.local:8123)
 * - HOME_TOKEN: Long-lived access token from Home Assistant
 *
 * @see https://developers.home-assistant.io/docs/api/rest/
 */

import { z } from "zod";

export interface HomeAssistantCfg {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  verifySsl?: boolean;
}

export type HomeAssistantError =
  | { kind: "auth"; status: 401 | 403; message: string; endpoint: string }
  | { kind: "notfound"; status: 404; message: string; endpoint: string }
  | { kind: "server"; status: number; message: string; endpoint: string }
  | { kind: "timeout"; message: string; endpoint: string }
  | { kind: "network"; message: string; endpoint: string; cause?: unknown }
  | { kind: "config"; message: string };

const entityStateSchema = z.object({
  entity_id: z.string(),
  state: z.string(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  last_changed: z.string().optional(),
  last_updated: z.string().optional(),
  context: z
    .object({
      id: z.string(),
      parent_id: z.string().nullable().optional(),
      user_id: z.string().nullable().optional(),
    })
    .optional(),
});

export type EntityState = z.infer<typeof entityStateSchema>;

export interface HomeEntity {
  id: string;
  name: string;
  domain: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface ServiceCallResult {
  success: boolean;
  entityId: string;
  state?: string;
}

export class HomeAssistant {
  private readonly cfg: Required<HomeAssistantCfg>;

  constructor(cfg: HomeAssistantCfg) {
    this.cfg = {
      baseUrl: cfg.baseUrl.replace(/\/$/, ""), // Remove trailing slash
      token: cfg.token,
      timeoutMs: cfg.timeoutMs ?? 5000,
      verifySsl: cfg.verifySsl ?? true,
    };
  }

  /**
   * Get all entity states or filter by domain
   */
  async getStates(domain?: string): Promise<EntityState[]> {
    const states = await this.request<EntityState[]>("GET", "/api/states");

    if (domain) {
      return states.filter((s) => s.entity_id.startsWith(`${domain}.`));
    }

    return states;
  }

  /**
   * Get a single entity's state
   */
  async getState(entityId: string): Promise<EntityState> {
    return await this.request<EntityState>("GET", `/api/states/${entityId}`);
  }

  /**
   * Call a service on a domain
   */
  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<EntityState[]> {
    const result = await this.request<EntityState[]>(
      "POST",
      `/api/services/${domain}/${service}`,
      data
    );
    return result ?? [];
  }

  /**
   * List all entities with their basic info
   */
  async listEntities(domain?: string): Promise<HomeEntity[]> {
    const states = await this.getStates(domain);
    return states.map((s) => this.stateToEntity(s));
  }

  /**
   * Control an entity with a service call
   */
  async controlEntity(
    entityId: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<ServiceCallResult> {
    const parts = entityId.split(".");
    const domain = parts[0];
    // Valid entity IDs must have format "domain.entity_name" (e.g., "light.living_room")
    if (!domain || parts.length < 2 || !parts[1]) {
      throw this.makeError("config", 0, `Invalid entity ID: ${entityId}`, "");
    }

    const serviceData = {
      entity_id: entityId,
      ...data,
    };

    const result = await this.callService(domain, service, serviceData);

    // Find the updated state for the entity we controlled
    const updatedState = result.find((s) => s.entity_id === entityId);

    return {
      success: true,
      entityId,
      state: updatedState?.state,
    };
  }

  /**
   * Get Home Assistant configuration (for entity discovery)
   */
  async getConfig(): Promise<Record<string, unknown>> {
    return await this.request<Record<string, unknown>>("GET", "/api/config");
  }

  /**
   * Check if the connection is valid
   */
  async ping(): Promise<boolean> {
    try {
      await this.request<{ message: string }>("GET", "/api/");
      return true;
    } catch {
      return false;
    }
  }

  private stateToEntity(state: EntityState): HomeEntity {
    const parts = state.entity_id.split(".");
    const domain = parts[0] ?? "unknown";
    const friendlyName =
      typeof state.attributes.friendly_name === "string"
        ? state.attributes.friendly_name
        : state.entity_id;

    return {
      id: state.entity_id,
      name: friendlyName,
      domain,
      state: state.state,
      attributes: state.attributes,
    };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.cfg.baseUrl}${path}`;

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.cfg.token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });

      if (!resp.ok) {
        const { status } = resp;
        throw this.makeError(
          status === 401 || status === 403
            ? "auth"
            : (status === 404
              ? "notfound"
              : "server"),
          status,
          resp.statusText || `HTTP ${status}`,
          path
        );
      }

      // Handle empty responses (some service calls return empty)
      const text = await resp.text();
      if (!text || text.trim().length === 0) {
        return [] as unknown as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      // Re-throw our own errors
      if (
        typeof error === "object" &&
        error !== null &&
        "kind" in error &&
        typeof (error as { kind: unknown }).kind === "string"
      ) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === "TimeoutError" ||
          error.name === "AbortError" ||
          error.message.includes("Timeout"))
      ) {
        throw this.makeError("timeout", 0, "Request timeout", path);
      }

      if (error instanceof Error && error.name === "TypeError") {
        throw this.makeError("network", 0, error.message, path, error);
      }

      throw error;
    }
  }

  private makeError(
    kind: HomeAssistantError["kind"],
    status: number,
    message: string,
    endpoint: string,
    cause?: unknown
  ): HomeAssistantError {
    switch (kind) {
      case "auth": {
        return { kind: "auth", status: status as 401 | 403, message, endpoint };
      }
      case "notfound": {
        return { kind: "notfound", status: 404, message, endpoint };
      }
      case "timeout": {
        return { kind: "timeout", message, endpoint };
      }
      case "network": {
        return { kind: "network", message, endpoint, cause };
      }
      case "config": {
        return { kind: "config", message };
      }
      default: {
        return { kind: "server", status, message, endpoint };
      }
    }
  }
}

/**
 * Create a Home Assistant client from environment variables
 */
export function createHomeAssistantClient(): HomeAssistant {
  const baseUrl = process.env.HOME_BASE_URL;
  const token = process.env.HOME_TOKEN;

  if (!(baseUrl && token)) {
    throw {
      kind: "config",
      message: "Missing HOME_BASE_URL or HOME_TOKEN environment variables",
    } as HomeAssistantError;
  }

  const timeoutMs = process.env.HOME_TIMEOUT_MS
    ? Number.parseInt(process.env.HOME_TIMEOUT_MS, 10)
    : 5000;

  const verifySsl = process.env.HOME_VERIFY_SSL !== "false";

  return new HomeAssistant({
    baseUrl,
    token,
    timeoutMs,
    verifySsl,
  });
}
