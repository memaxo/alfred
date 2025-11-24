// #region agent log
fetch("http://127.0.0.1:7242/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    location: "server.ts:1",
    message: "BEFORE import server-entry",
    data: { hypothesisId: "D" },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "initial",
  }),
}).catch(() => {});

// #endregion
import handler from "@tanstack/react-start/server-entry";
import { withRequestTestSession } from "@/lib/test-auth";

// #region agent log
fetch("http://127.0.0.1:7242/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    location: "server.ts:3",
    message: "AFTER import server-entry",
    data: {
      hypothesisId: "B",
      handlerType: typeof handler,
      handlerFetchType: typeof handler?.fetch,
    },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "initial",
  }),
}).catch(() => {});

// #endregion
import { initServer } from "./server/bootstrap";

// Initialize server-side services before handling requests
// #region agent log
fetch("http://127.0.0.1:7242/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    location: "server.ts:7",
    message: "BEFORE initServer call",
    data: { hypothesisId: "D" },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "initial",
  }),
}).catch(() => {});
// #endregion
initServer();
// #region agent log
fetch("http://127.0.0.1:7242/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    location: "server.ts:9",
    message: "AFTER initServer call",
    data: { hypothesisId: "D" },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "initial",
  }),
}).catch(() => {});
// #endregion

// Export default handler conforming to ServerEntry interface
// This is the entry point for TanStack Start SSR and API routes
// TanStack Start will automatically detect this file as the server entry point
export default {
  fetch(request: Request) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "server.ts:16",
        message: "INSIDE fetch handler",
        data: { hypothesisId: "B", url: request.url },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "initial",
      }),
    }).catch(() => {});
    // #endregion
    return withRequestTestSession(request, () => handler.fetch(request));
  },
};
