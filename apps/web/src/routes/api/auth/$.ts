import { isDbConnectionError } from "@alfred/api/utils/service-availability";
import { auth } from "@alfred/auth";
import { logger } from "@alfred/logger";
import { createFileRoute } from "@tanstack/react-router";

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
  try {
    return await auth.handler(request);
  } catch (error) {
    // Check for database connection errors using type guard
    if (isDbConnectionError(error)) {
      logger.warn("auth_db_unavailable", {
        message: "Database unavailable, returning no session",
        error: error instanceof Error ? error.message : String(error),
      });
      return createNoSessionResponse();
    }

    // Re-throw non-database errors
    logger.error("auth_unexpected_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => {
        logger.debug("auth_get_request", { url: request.url });
        return safeAuthHandler(request);
      },
      POST: ({ request }) => {
        logger.debug("auth_post_request", { url: request.url });
        return safeAuthHandler(request);
      },
    },
  },
});
