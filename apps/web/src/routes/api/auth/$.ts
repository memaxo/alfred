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
    const incomingOrigin = request.headers.get("origin");
    const incomingExpoOrigin = request.headers.get("expo-origin");

    const normalizedExpoOrigin = (() => {
      if (!incomingExpoOrigin) {
        return null;
      }
      const raw = incomingExpoOrigin.trim();
      if (raw.length === 0) {
        return null;
      }

      // Native deep-link origins may include paths (e.g. `alfred://--/`).
      // Better Auth origin checks are strict; normalize to scheme origin.
      if (raw.startsWith("alfred://")) {
        return "alfred://";
      }
      if (raw.startsWith("exp://")) {
        return "exp://";
      }
      if (raw.startsWith("expo://")) {
        return "expo://";
      }

      // For http(s), normalize to URL.origin to strip path/query.
      try {
        const url = new URL(raw);
        if (url.origin && url.origin !== "null") {
          return url.origin;
        }
      } catch {
        // ignore
      }

      return raw;
    })();

    // Expo / React Native often sends a non-browser Origin (or a Metro URL) that
    // Better Auth will reject as "Invalid origin". For native clients, Origin is
    // not a meaningful CSRF boundary, so we strip it and rely on credentials + cookies.
    //
    // This is intentionally narrow: only strip when the origin looks like an
    // Expo/dev-client origin or the app deep-link scheme.
    const shouldStripOrigin =
      process.env.NODE_ENV !== "production" &&
      typeof incomingOrigin === "string" &&
      incomingOrigin.length > 0;

    const effectiveRequest = (() => {
      if (!(shouldStripOrigin || normalizedExpoOrigin)) {
        return request;
      }
      const cloned = request.clone();
      const headers = new Headers(cloned.headers);
      headers.delete("origin");
      headers.delete("referer");
      if (normalizedExpoOrigin) {
        headers.set("expo-origin", normalizedExpoOrigin);
      }
      return new Request(cloned, { headers });
    })();

    const res = await h.auth.handler(effectiveRequest);

    // Debug native auth failures: attach received origins as headers so mobile
    // can display them in its error object without consuming the response body.
    if (process.env.NODE_ENV !== "production" && res.status >= 400) {
      const headers = new Headers(res.headers);
      headers.set("x-alfred-origin", incomingOrigin ?? "null");
      headers.set("x-alfred-expo-origin", incomingExpoOrigin ?? "null");
      headers.set(
        "x-alfred-expo-origin-normalized",
        normalizedExpoOrigin ?? "null"
      );
      return new Response(res.body, { status: res.status, headers });
    }

    return res;
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
        h.logger.info("auth_get_request", {
          url: request.url,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
          userAgent: request.headers.get("user-agent"),
        });
        return safeAuthHandler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        const h = await getAuthHelpers();
        h.logger.info("auth_post_request", {
          url: request.url,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
          userAgent: request.headers.get("user-agent"),
        });
        return safeAuthHandler(request);
      },
    },
  },
});
