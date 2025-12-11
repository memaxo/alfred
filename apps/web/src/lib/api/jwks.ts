import { getJWKS } from "@alfred/auth/jwks";
import { createFileRoute } from "@tanstack/react-router";

// @ts-expect-error - Route path generated at build time
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
