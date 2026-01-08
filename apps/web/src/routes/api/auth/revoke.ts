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

async function getDbHelpers() {
  const dbPkg = "@alfred/db";
  const schemaPkg = "@alfred/db/schema/auth";
  const drizzlePkg = "drizzle-orm";

  const [dbMod, schemaMod, drizzleMod] = await Promise.all([
    import(dbPkg),
    import(schemaPkg),
    import(drizzlePkg),
  ]);

  return {
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

        try {
          const { db, oauthAccessToken, eq } = await getDbHelpers();

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
          // biome-ignore lint/suspicious/noConsole: Error logging
          console.error("Token revocation failed:", error);

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
