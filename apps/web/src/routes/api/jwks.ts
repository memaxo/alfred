import { getJWKS } from "@alfred/auth/jwks";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/jwks")({
  server: {
    handlers: {
      GET: async () => {
        const jwks = await getJWKS();
        return new Response(JSON.stringify(jwks), {
          headers: {
            "content-type": "application/json",
          },
        });
      },
    },
  },
});
