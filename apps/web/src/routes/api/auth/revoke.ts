/**
 * OAuth 2.0 Token Revocation Endpoint (RFC 7009)
 *
 * Allows clients to notify the authorization server that a previously
 * obtained refresh or access token is no longer needed.
 *
 * Better Auth OIDC Provider does not implement this by default, so we add it.
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc7009
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/revoke")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiPkg = "@alfred/api/auth-revoke";
        const { handleAuthRevoke } = await import(/* @vite-ignore */ apiPkg);
        return handleAuthRevoke(request);
      },
    },
  },
});
