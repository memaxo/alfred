import handler from "@tanstack/react-start/server-entry";
import { initServer } from "./server/bootstrap";

// Initialize server-side services before handling requests
initServer();

// Export default handler conforming to ServerEntry interface
// This is the entry point for TanStack Start SSR and API routes
// TanStack Start will automatically detect this file as the server entry point
export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};

