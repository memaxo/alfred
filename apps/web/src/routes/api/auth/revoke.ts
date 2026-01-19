/**
 * OAuth 2.0 Token Revocation Endpoint (RFC 7009)
 *
 * Allows clients to notify the authorization server that a previously
 * obtained refresh or access token is no longer needed.
 *
 * Better Auth OIDC Provider does not implement this by default, so we add it.
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc7009
 */

import { createFileRoute } from "@tanstack/react-router";

async function getLogger() {
  const loggerPkg = "@alfred/logger";
  const { logger } = (await import(
    /* @vite-ignore */ loggerPkg
  )) as typeof import("@alfred/logger");
  return logger;
}

async function getDbHelpers() {
  const availabilityPkg = "@alfred/api/utils/service-availability";
  const dbPkg = "@alfred/db";
  const schemaPkg = "@alfred/db/schema/auth";
  const drizzlePkg = "drizzle-orm";

  const availability = (await import(
    /* @vite-ignore */ availabilityPkg
  )) as typeof import("@alfred/api/utils/service-availability");
  const dbMod = (await import(
    /* @vite-ignore */ dbPkg
  )) as typeof import("@alfred/db");
  const schemaMod = (await import(
    /* @vite-ignore */ schemaPkg
  )) as typeof import("@alfred/db/schema/auth");
  const drizzleMod = (await import(
    /* @vite-ignore */ drizzlePkg
  )) as typeof import("drizzle-orm");

  return {
    isDbConnectionError: availability.isDbConnectionError,
    db: dbMod.db,
    oauthAccessToken: schemaMod.oauthAccessToken,
    eq: drizzleMod.eq,
  };
}

export const Route = createFileRoute("/api/auth/revoke")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Parse form body
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("application/x-www-form-urlencoded")) {
          return Response.json(
            { error: "unsupported_content_type" },
            { status: 400 }
          );
        }

        const body = await request.text();
        const params = new URLSearchParams(body);
        const token = params.get("token");
        const tokenTypeHint = params.get("token_type_hint"); // access_token or refresh_token

        if (!token) {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }

        let isDbConnectionError: ((error: unknown) => boolean) | null = null;
        try {
          const helpers = await getDbHelpers();
          isDbConnectionError = helpers.isDbConnectionError;
          const { db, oauthAccessToken, eq } = helpers;

          // RFC 7009: The authorization server responds with HTTP status 200
          // regardless of whether the token was valid or already revoked.

          // Try to find and delete the token
          if (tokenTypeHint === "refresh_token") {
            // Delete by refresh token
            await db
              .delete(oauthAccessToken)
              .where(eq(oauthAccessToken.refreshToken, token));
          } else {
            // Delete by access token (default)
            await db
              .delete(oauthAccessToken)
              .where(eq(oauthAccessToken.accessToken, token));
          }

          // RFC 7009: Return 200 OK with empty body on success
          return new Response(null, {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
          });
        } catch (error) {
          const logger = await getLogger();
          if (isDbConnectionError?.(error)) {
            logger.warn("auth_token_revocation_db_unavailable", {
              error: error instanceof Error ? error.message : String(error),
            });
          } else {
            logger.error("auth_token_revocation_failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }

          // RFC 7009: Even on server error, respond with 200 to prevent
          // information leakage about token validity
          return new Response(null, {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
          });
        }
      },
    },
  },
});
