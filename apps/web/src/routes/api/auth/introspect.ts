/**
 * OAuth 2.0 Token Introspection Endpoint (RFC 7662)
 *
 * Allows resource servers to query the authorization server about the
 * state of an access token and to determine meta-information about the token.
 *
 * Better Auth OIDC Provider does not implement this by default, so we add it.
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc7662
 */

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

export const serverFunctions = {
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

      // Look up token in database
      const [tokenRecord] = await db
        .select()
        .from(oauthAccessToken)
        .where(
          tokenTypeHint === "refresh_token"
            ? eq(oauthAccessToken.refreshToken, token)
            : eq(oauthAccessToken.accessToken, token)
        )
        .limit(1);

      // RFC 7662: If token is invalid/expired, return { active: false }
      if (!tokenRecord) {
        return Response.json(
          { active: false },
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
          }
        );
      }

      // Check expiration
      const isAccessToken = tokenTypeHint !== "refresh_token";
      const expiresAt = isAccessToken
        ? tokenRecord.accessTokenExpiresAt
        : tokenRecord.refreshTokenExpiresAt;

      if (expiresAt && new Date(expiresAt) < new Date()) {
        return Response.json(
          { active: false },
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
          }
        );
      }

      // Token is valid - return introspection response
      const response = {
        active: true,
        scope: tokenRecord.scopes,
        client_id: tokenRecord.clientId,
        username: tokenRecord.userId,
        token_type: "Bearer",
        exp: expiresAt
          ? Math.floor(new Date(expiresAt).getTime() / 1000)
          : undefined,
        iat: Math.floor(new Date(tokenRecord.createdAt).getTime() / 1000),
        sub: tokenRecord.userId,
        iss: process.env.BETTER_AUTH_URL || "http://localhost:3000",
      };

      return Response.json(response, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Error logging
      console.error("Token introspection failed:", error);

      // Don't expose internal errors - return inactive
      return Response.json(
        { active: false },
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            Pragma: "no-cache",
          },
        }
      );
    }
  },
};

// Export for TanStack Start route handling
export const Route = {
  server: {
    handlers: serverFunctions,
  },
};
