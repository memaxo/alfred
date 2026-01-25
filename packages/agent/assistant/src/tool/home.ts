/**
 * Home Automation Tool
 *
 * Provides integration with home automation systems for status queries and control.
 *
 * Supported Actions:
 * - status: Get status of home entities (scope: home.read)
 * - control: Control home entities (scope: home.write)
 * - list: List available entities (scope: home.read)
 *
 * Required Environment:
 * - HOME_PROVIDER: Provider selection (homeassistant, fake)
 * - HOME_BASE_URL: API endpoint (e.g., http://homeassistant.local:8123)
 * - HOME_TOKEN: Long-lived access token
 *
 * Optional Environment:
 * - HOME_VERIFY_SSL: SSL verification (default: true)
 * - HOME_TIMEOUT_MS: Request timeout (default: 5000)
 */

import type { RuntimeContext } from "@alfred/type/runtime-context";

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";

import {
  createHomeAssistantClient,
  type HomeAssistantError,
  type HomeEntity,
} from "../../../src/lib/homeassistant";
import { recordAssistantToolCall } from "../../../src/metrics";

const entitySchema = z.object({
  id: z.string().describe("Entity ID (e.g., light.living_room)"),
  name: z.string().describe("Friendly name of the entity"),
  domain: z.string().describe("Domain (e.g., light, switch, climate)"),
  state: z.string().describe("Current state (e.g., on, off, 72)"),
  attributes: z
    .record(z.string(), z.unknown())
    .describe("Additional attributes for the entity"),
});

const homeInputSchema = z
  .object({
    userId: z.string().min(1).describe("User ID for authorization"),
    action: z
      .enum(["status", "control", "list"])
      .describe("Action to perform on home entities"),
    entity: z
      .string()
      .optional()
      .describe("Entity ID for status/control (e.g., light.living_room)"),
    domain: z
      .string()
      .optional()
      .describe("Domain filter for list/status (e.g., light, climate)"),
    service: z
      .string()
      .optional()
      .describe("Service to call for control (e.g., turn_on, set_temperature)"),
    data: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Service data for control (e.g., { brightness: 255 })"),
    authz: z
      .string()
      .optional()
      .describe("Authorization token for policy enforcement"),
  })
  .strict();

const homeOutputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    entities: z.array(entitySchema).describe("Status of requested entities"),
  }),
  z.object({
    action: z.literal("control"),
    success: z.boolean().describe("Whether the control operation succeeded"),
    entityId: z.string().describe("Entity that was controlled"),
    state: z.string().optional().describe("New state after control"),
  }),
  z.object({
    action: z.literal("list"),
    entities: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          domain: z.string(),
        })
      )
      .describe("List of available entities"),
  }),
]);

type HomeInput = z.infer<typeof homeInputSchema>;
type HomeOutput = z.infer<typeof homeOutputSchema>;
interface HomeError {
  ok: false;
  code: string;
  message: string;
  detail?: string;
}

function scopesForAction(action: HomeInput["action"]): string[] {
  return action === "control" ? ["home.write"] : ["home.read"];
}

function policyAction(action: HomeInput["action"]): string {
  return action === "control" ? "home.control" : "home.read";
}

function autonomyLevel(action: HomeInput["action"]): number {
  // Read operations: 0.0-0.3 (read-only)
  // Control operations: 0.5-0.7 (medium, potentially impactful)
  return action === "control" ? 0.6 : 0.2;
}

function isHomeAssistantError(err: unknown): err is HomeAssistantError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    typeof (err as { kind: unknown }).kind === "string"
  );
}

function errorToResponse(err: unknown): HomeError {
  if (isHomeAssistantError(err)) {
    return {
      ok: false,
      code: `home_${err.kind}`,
      message: err.message,
      detail: "endpoint" in err ? err.endpoint : undefined,
    };
  }

  return {
    ok: false,
    code: "home_error",
    message: err instanceof Error ? err.message : String(err),
  };
}

function entityToOutput(entity: HomeEntity) {
  return {
    id: entity.id,
    name: entity.name,
    domain: entity.domain,
    state: entity.state,
    attributes: entity.attributes,
  };
}

/**
 * Check if the home provider is configured
 */
function isProviderConfigured(): boolean {
  const provider = process.env.HOME_PROVIDER;
  // Not configured, or explicitly set to "fake"
  if (!provider || provider === "fake") {
    return false;
  }
  // Home Assistant requires URL and token
  if (provider === "homeassistant") {
    return Boolean(process.env.HOME_BASE_URL && process.env.HOME_TOKEN);
  }
  return false;
}

export const toolHome = {
  name: "home",
  description:
    "Interact with home automation systems. Supports: status (get entity states), control (execute services), list (discover entities). Requires HOME_PROVIDER, HOME_BASE_URL, and HOME_TOKEN environment variables.",
  inputSchema: homeInputSchema,
  outputSchema: z.union([
    homeOutputSchema,
    z.object({
      ok: z.literal(false),
      code: z.string(),
      message: z.string(),
      detail: z.string().optional(),
    }),
  ]),
  execute: async ({
    input,
    runtimeContext,
  }: {
    input: HomeInput;
    runtimeContext?: RuntimeContext;
  }): Promise<HomeOutput | HomeError> => {
    recordAssistantToolCall("home");

    try {
      // Policy enforcement
      await requireToolScopesAndPolicy(
        input.authz,
        scopesForAction(input.action),
        {
          action: policyAction(input.action),
          resource: {
            kind: "home",
            id: input.entity ?? "all",
          },
          context: {
            runtimeContextId: runtimeContext?.get?.("requestId"),
            autonomyLevel: autonomyLevel(input.action),
          },
        }
      );

      // Check if provider is configured
      if (!isProviderConfigured()) {
        return {
          ok: false,
          code: "home_not_configured",
          message:
            "Home automation provider not configured. Set HOME_PROVIDER, HOME_BASE_URL, and HOME_TOKEN environment variables.",
        };
      }

      const client = createHomeAssistantClient();

      switch (input.action) {
        case "status": {
          if (input.entity) {
            // Get single entity status
            const state = await client.getState(input.entity);
            const entity = {
              id: state.entity_id,
              name:
                typeof state.attributes.friendly_name === "string"
                  ? state.attributes.friendly_name
                  : state.entity_id,
              domain: state.entity_id.split(".")[0] ?? "unknown",
              state: state.state,
              attributes: state.attributes,
            };
            return {
              action: "status",
              entities: [entityToOutput(entity)],
            };
          }
          // Get all entities, optionally filtered by domain
          const entities = await client.listEntities(input.domain);
          return {
            action: "status",
            entities: entities.map(entityToOutput),
          };
        }

        case "control": {
          if (!input.entity) {
            return {
              ok: false,
              code: "home_entity_required",
              message: "Entity ID is required for control action",
            };
          }
          if (!input.service) {
            return {
              ok: false,
              code: "home_service_required",
              message:
                "Service name is required for control action (e.g., turn_on, turn_off)",
            };
          }

          const result = await client.controlEntity(
            input.entity,
            input.service,
            input.data
          );

          return {
            action: "control",
            success: result.success,
            entityId: result.entityId,
            state: result.state,
          };
        }

        case "list": {
          const entities = await client.listEntities(input.domain);
          return {
            action: "list",
            entities: entities.map((e) => ({
              id: e.id,
              name: e.name,
              domain: e.domain,
            })),
          };
        }

        default: {
          return {
            ok: false,
            code: "home_invalid_action",
            message: `Unknown action: ${input.action}`,
          };
        }
      }
    } catch (error) {
      return errorToResponse(error);
    }
  },
};

export type ToolHome = typeof toolHome;
