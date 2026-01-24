import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";

import type { ToolExecuteArgs } from "./shared/context.js";

const routerInputSchema = z.object({
  action: z.enum(["register", "update", "remove"]),
  host: z.string().min(1),
  upstream: z.string().url().optional(),
  tls: z.boolean().optional(),
  authz: z.string().optional(),
});

type RouterInput = z.infer<typeof routerInputSchema>;

const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL ?? "http://127.0.0.1:2019";

async function enforcePolicy(input: RouterInput) {
  await requireToolScopesAndPolicy(input.authz, ["deploy.write"], {
    action: `router.${input.action}`,
    resource: {
      kind: "route",
      id: input.host,
    },
  });
}

function ensureUpstream(input: RouterInput) {
  if (!input.upstream || input.upstream.trim().length === 0) {
    throw new Error("router_upstream_required");
  }
  return input.upstream;
}

function buildCaddyRoute(
  host: string,
  upstreamUrl: string,
  _tls: boolean | undefined
) {
  const upstream = new URL(upstreamUrl);
  const dial =
    upstream.port && upstream.port.length > 0
      ? `${upstream.hostname}:${upstream.port}`
      : upstream.hostname;

  return {
    "@id": `alfred-route-${host.replace(/[^a-zA-Z0-9.-]/g, "-")}`,
    match: [
      {
        host: [host],
      },
    ],
    handle: [
      {
        handler: "reverse_proxy",
        upstreams: [
          {
            dial,
          },
        ],
      },
    ],
    terminal: true,
  };
}

async function caddyRequest(
  path: string,
  init: RequestInit,
  options?: { ignore404?: boolean }
) {
  const url = new URL(path, CADDY_ADMIN_URL);
  const response = await fetch(url, init);
  if (!response.ok) {
    if (options?.ignore404 && response.status === 404) {
      return response;
    }
    const text = await response.text();
    throw new Error(`router_caddy_error:${response.status}:${text}`);
  }
  return response;
}

async function executeCaddy(input: RouterInput) {
  const routeId = `alfred-route-${input.host.replace(/[^a-zA-Z0-9.-]/g, "-")}`;

  switch (input.action) {
    case "register":
    case "update": {
      const upstream = ensureUpstream(input);
      const body = JSON.stringify(
        buildCaddyRoute(input.host, upstream, input.tls)
      );
      await caddyRequest(`/config/apps/http/servers/srv0/routes/${routeId}`, {
        method: "PUT",
        body,
        headers: {
          "content-type": "application/json",
        },
      });
      return { ok: true };
    }
    case "remove": {
      await caddyRequest(
        `/config/apps/http/servers/srv0/routes/${routeId}`,
        {
          method: "DELETE",
        },
        { ignore404: true }
      );
      return { ok: true };
    }
    default:
      throw new Error("router_action_not_supported");
  }
}

export const toolRouter = {
  name: "router",
  description: "Manage reverse proxy routes for preview/prod environments.",
  inputSchema: routerInputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
  }),
  execute: async ({ input }: ToolExecuteArgs<RouterInput>) => {
    await enforcePolicy(input);
    return executeCaddy(input);
  },
};

export type ToolRouter = typeof toolRouter;
