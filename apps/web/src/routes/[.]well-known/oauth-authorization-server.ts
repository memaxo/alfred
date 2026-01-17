import { createFileRoute } from "@tanstack/react-router";

/**
 * OAuth 2.1 Authorization Server Metadata Endpoint
 *
 * Exposes OAuth 2.1/OIDC discovery metadata for MCP clients and other OAuth consumers.
 * Better Auth handles this at /api/auth/.well-known/oauth-authorization-server,
 * but we also expose it here for clients that don't parse WWW-Authenticate headers correctly.
 *
 * Reference: RFC 8414 (OAuth 2.0 Authorization Server Metadata)
 */
export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        GET: () => {
          const baseUrl =
            process.env.BETTER_AUTH_URL || "http://localhost:3000";
          const origin = baseUrl.replace(/\/$/, "");

          // OAuth 2.1/OIDC metadata
          const metadata = {
            issuer: origin,
            authorization_endpoint: `${origin}/api/auth/oauth2/authorize`,
            token_endpoint: `${origin}/api/auth/oauth2/token`,
            device_authorization_endpoint: `${origin}/api/auth/oauth2/device/code`,
            userinfo_endpoint: `${origin}/api/auth/oauth2/userinfo`,
            jwks_uri: `${origin}/api/auth/.well-known/jwks.json`,
            scopes_supported: [
              "openid",
              "profile",
              "email",
              "offline_access",
              "read:*",
              "write:*",
              "admin:*",
            ],
            response_types_supported: ["code"],
            grant_types_supported: [
              "authorization_code",
              "refresh_token",
              "urn:ietf:params:oauth:grant-type:device_code",
            ],
            token_endpoint_auth_methods_supported: [
              "client_secret_basic",
              "client_secret_post",
              "none", // For public clients
            ],
            code_challenge_methods_supported: ["S256", "plain"],
            // OIDC-specific
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256", "ES256"],
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
  }
);
