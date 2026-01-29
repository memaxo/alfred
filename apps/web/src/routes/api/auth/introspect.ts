/**
 * OAuth 2.0 Token Introspection Endpoint (RFC 7662)
 *
 * Allows resource servers to query the authorization server about the
 * state of an access token and to determine meta-information about the token.
 *
 * Better Auth OIDC Provider does not implement this by default, so we add it.
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc7662
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/introspect")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiPkg = "@alfred/api/auth-introspect";
        const { handleAuthIntrospect } = await import(
          /* @vite-ignore */ apiPkg
        );
        return handleAuthIntrospect(request);
      },
    },
  },
});
