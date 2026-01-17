import { createFileRoute } from "@tanstack/react-router";

/**
 * OAuth 2.1 Protected Resource Metadata Endpoint
 *
 * Exposes metadata about the protected resource (ALFRED API) for OAuth clients.
 * Better Auth handles this at /api/auth/.well-known/oauth-protected-resource,
 * but we also expose it here for MCP clients.
 *
 * Reference: RFC 8705 (OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens)
 */
export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: () => {
        const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
        const origin = baseUrl.replace(/\/$/, "");

        // Protected Resource Metadata
        const metadata = {
          resource: origin,
          authorization_servers: [origin],
          scopes_supported: [
            "openid",
            "profile",
            "email",
            "read:*",
            "write:*",
            "admin:*",
          ],
          bearer_methods_supported: ["header", "query"],
          resource_documentation: `${origin}/docs`,
          resource_policy_uri: `${origin}/docs/privacy`,
        };

        return Response.json(metadata, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
