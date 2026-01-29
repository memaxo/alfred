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

export async function handleAuthIntrospect(
  request: Request
): Promise<Response> {
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
    const logger = await getLogger();
    if (isDbConnectionError?.(error)) {
      logger.warn("auth_token_introspection_db_unavailable", {
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      logger.error("auth_token_introspection_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
}
