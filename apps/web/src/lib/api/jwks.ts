import { getJWKS } from "@alfred/auth/jwks";
import { createFileRoute } from "@tanstack/react-router";

// @ts-expect-error - TanStack Start server handlers
export const Route = createFileRoute("/api/jwks")({
  server: {
    handlers: {
      GET: async () => {
        const jwks = await getJWKS();
        return Response.json(jwks);
      },
    },
  },
});
