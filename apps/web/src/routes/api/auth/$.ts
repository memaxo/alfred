import { createFileRoute } from "@tanstack/react-router";

async function getAuthHelpers() {
  const availabilityPkg = "@alfred/api/utils/service-availability";
  const authPkg = "@alfred/auth";
  const loggerPkg = "@alfred/logger";

  const [availability, authMod, loggerMod] = await Promise.all([
    import(/* @vite-ignore */ availabilityPkg),
    import(/* @vite-ignore */ authPkg),
    import(/* @vite-ignore */ loggerPkg),
  ]);

  return {
    isDbConnectionError: availability.isDbConnectionError,
    auth: authMod.auth,
    logger: loggerMod.logger,
  };
}

/**
 * FIX: Graceful auth handling when DB unavailable
 * Create a "no session" response for when the database is unavailable.
 * This allows the app to render without a session instead of crashing.
 */
function createNoSessionResponse(): Response {
  return Response.json(
    { session: null, user: null },
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Wrap auth handler with error handling for database unavailability.
 * Returns a graceful "no session" response instead of crashing.
 */
async function safeAuthHandler(request: Request): Promise<Response> {
  const h = await getAuthHelpers();
  try {
    return await h.auth.handler(request);
  } catch (error) {
    // Check for database connection errors using type guard
    if (h.isDbConnectionError(error)) {
      h.logger.warn("auth_db_unavailable", {
        message: "Database unavailable, returning no session",
        error: error instanceof Error ? error.message : String(error),
      });
      return createNoSessionResponse();
    }

    // Re-throw non-database errors
    h.logger.error("auth_unexpected_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const h = await getAuthHelpers();
        h.logger.debug("auth_get_request", { url: request.url });
        return safeAuthHandler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        const h = await getAuthHelpers();
        h.logger.debug("auth_post_request", { url: request.url });
        return safeAuthHandler(request);
      },
    },
  },
});
