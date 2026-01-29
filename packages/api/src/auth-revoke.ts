import type { Logger } from "@alfred/logger";

async function getLogger(): Promise<Logger> {
  const { logger } =
    (await import("@alfred/logger")) as typeof import("@alfred/logger");
  return logger;
}

async function getDbHelpers() {
  const availability =
    (await import("./utils/service-availability")) as typeof import("./utils/service-availability");
  const dbMod = (await import("@alfred/db")) as typeof import("@alfred/db");
  const schemaMod =
    (await import("@alfred/db/schema/auth")) as typeof import("@alfred/db/schema/auth");
  const drizzleMod =
    (await import("drizzle-orm")) as typeof import("drizzle-orm");

  return {
    isDbConnectionError: availability.isDbConnectionError,
    db: dbMod.db,
    oauthAccessToken: schemaMod.oauthAccessToken,
    eq: drizzleMod.eq,
  };
}

export async function handleAuthRevoke(request: Request): Promise<Response> {
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
    ({ isDbConnectionError } = helpers);
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
}
