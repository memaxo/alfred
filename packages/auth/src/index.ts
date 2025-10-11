import { expo } from '@better-auth/expo';
import { reactStartCookies } from 'better-auth/react-start';
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@alfred/db";
import * as schema from "@alfred/db/schema/auth";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",

		schema: schema,
	}),
	trustedOrigins: [process.env.CORS_ORIGIN || "", "mybettertapp://", "exp://"],
	emailAndPassword: {
		enabled: true,
	},
  plugins: [reactStartCookies(), expo()]
});
