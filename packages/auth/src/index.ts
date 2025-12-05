import { db } from "@alfred/db";
import * as schema from "@alfred/db/schema/auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { passkey } from "better-auth/plugins/passkey";
import { reactStartCookies } from "better-auth/react-start";
import { autoGrantBiometricIfBypassed, setBiometricTicket } from "./biometric";

const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
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
  "mybettertapp://",
  "exp://",
  origin,
].filter(Boolean) as string[];

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
    reactStartCookies(),
  ],
});
