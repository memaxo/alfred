import { auth } from "@alfred/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => {
        console.log("[Auth] GET request:", request.url);
        return auth.handler(request);
      },
      POST: ({ request }) => {
        console.log("[Auth] POST request:", request.url);
        return auth.handler(request);
      },
    },
  },
});
