import { db } from "@alfred/db";
import * as schema from "@alfred/db/schema/auth";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { deviceAuthorization, oidcProvider } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { autoGrantBiometricIfBypassed, setBiometricTicket } from "./biometric";

const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3001";
const origin = baseUrl.replace(/\/$/, "");
const rpID = (() => {
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
})();

const trustedOrigins = [
  process.env.CORS_ORIGIN,
  origin,
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "alfred://",
  "alfred://*",
  "mybettertapp://",
  "mybettertapp://*",
  "exp://",
  "exp://*",
  "expo://",
  "expo://*",
].filter(Boolean) as string[];

/**
 * Build trusted client list from environment variables.
 * Trusted clients skip the consent screen (for first-party integrations).
 */
function getTrustedClients(): string[] {
  const clients: string[] = [];

  // Cursor IDE MCP client
  if (process.env.CURSOR_CLIENT_ID && process.env.CURSOR_CLIENT_SECRET) {
    clients.push(process.env.CURSOR_CLIENT_ID);
  }

  // Claude Desktop MCP client
  if (process.env.CLAUDE_CLIENT_ID && process.env.CLAUDE_CLIENT_SECRET) {
    clients.push(process.env.CLAUDE_CLIENT_ID);
  }

  // Generic MCP client (for custom integrations)
  if (process.env.MCP_CLIENT_ID && process.env.MCP_CLIENT_SECRET) {
    clients.push(process.env.MCP_CLIENT_ID);
  }

  return clients;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    passkey({
      rpID,
      rpName: "ALFRED",
      origin,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "preferred",
      },
    }),
    {
      id: "bio-ticket",
      hooks: {
        after: [
          {
            matcher: (ctx) => ctx.path === "/sign-in/passkey",
            handler: createAuthMiddleware(async (ctx) => {
              const session =
                ctx.context.newSession?.session ??
                ctx.context.session?.session ??
                null;
              const sessionId = session?.id || session?.token;
              if (!sessionId) {
                return;
              }
              await setBiometricTicket(sessionId, 120);
            }),
          },
          {
            // Auto-grant bio ticket for email sign-in when BIO_AUTH_BYPASS is enabled
            matcher: (ctx) => ctx.path === "/sign-in/email",
            handler: createAuthMiddleware(async (ctx) => {
              const session =
                ctx.context.newSession?.session ??
                ctx.context.session?.session ??
                null;
              const sessionId = session?.id || session?.token;
              if (!sessionId) {
                return;
              }
              await autoGrantBiometricIfBypassed(sessionId);
            }),
          },
        ],
      },
    },
    expo(),
    tanstackStartCookies(),
    deviceAuthorization({
      verificationUri: "/device",
      userCodeLength: 8,
      expiresIn: "15m",
      interval: "5s",
    }),
    // OIDC Provider for MCP and external integrations
    // Enables OAuth 2.1/OIDC compliance for AI agent authentication
    oidcProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      // Trusted clients can skip consent (e.g., internal tools)
      // Configured via environment variables for security
      // Note: better-auth expects client ID strings but type definition requires Client objects
      trustedClients: getTrustedClients() as unknown as Parameters<
        typeof oidcProvider
      >[0]["trustedClients"],
      // Custom metadata
      metadata: {
        issuer: origin,
        scopes_supported: [
          "openid",
          "profile",
          "email",
          "offline_access",
          // Read scopes
          "read:*",
          "read:todos",
          "read:notes",
          "read:reminders",
          "read:knowledge",
          "read:cognitive",
          "read:workflows",
          "read:timers",
          "read:bookmarks",
          // Write scopes
          "write:*",
          "write:todos",
          "write:notes",
          "write:reminders",
          "write:knowledge",
          "write:workflows",
          "write:timers",
          "write:bookmarks",
          // Admin scopes
          "admin:*",
          "admin:voice",
          "admin:workflow",
          "admin:deploy",
          "admin:system",
        ],
      },
    }),
  ],
});
