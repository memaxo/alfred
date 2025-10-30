---
title: Migrating from Supabase Auth to Better Auth | Better Auth
url: 
description: A step-by-step guide to transitioning from Supabase Auth to Better Auth.
language: en
---
[\_helo](https://www.better-auth.com/) [docs](https://www.better-auth.com/docs) [examples](https://www.better-auth.com/docs/examples/next-js) [changelogs](https://www.better-auth.com/changelogs) [blogs](https://www.better-auth.com/blog) [community](https://www.better-auth.com/community)

### Get Started

### Concepts

### Authentication

### Databases

### Integrations

### Plugins

### Guides

### Reference

# Migrating from Supabase Auth to Better Auth

Copy MarkdownOpen in

In this guide, we'll walk through the steps to migrate a project from Supabase Auth to Better Auth.

This migration will invalidate all active sessions. While this guide doesn't currently cover migrating two-factor (2FA) or Row Level Security (RLS) configurations, both should be possible with additional steps.

## [Before You Begin](https://www.better-auth.com/docs/guides/supabase-migration-guide\#before-you-begin)

Before starting the migration process, set up Better Auth in your project. Follow the [installation guide](https://www.better-auth.com/docs/installation) to get started.

### [Connect to your database](https://www.better-auth.com/docs/guides/supabase-migration-guide\#connect-to-your-database)

You'll need to connect to your database to migrate the users and accounts. Copy your `DATABASE_URL` from your Supabase project and use it to connect to your database. And for this example, we'll need to install `pg` to connect to the database.

npm

pnpm

yarn

bun

```
npm install pg
```

And then you can use the following code to connect to your database.

auth.ts

```
import { Pool } from "pg";

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL
    }),
})
```

### [Enable Email and Password (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide\#enable-email-and-password-optional)

Enable the email and password in your auth config.

auth.ts

```
import { admin, anonymous } from "better-auth/plugins";

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL
    }),
	emailVerification: {
		sendEmailVerification: async(user)=>{
			// send email verification email
			// implement your own logic here
		}
	},
    emailAndPassword: {
        enabled: true,
    }
})
```

### [Setup Social Providers (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide\#setup-social-providers-optional)

Add social providers you have enabled in your Supabase project in your auth config.

auth.ts

```
import { admin, anonymous } from "better-auth/plugins";

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        }
    }
})
```

### [Add admin and anonymous plugins (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide\#add-admin-and-anonymous-plugins-optional)

Add the [admin](https://www.better-auth.com/docs/plugins/admin) and [anonymous](https://www.better-auth.com/docs/plugins/anonymous) plugins to your auth config.

auth.ts

```
import { admin, anonymous } from "better-auth/plugins";

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }
    },
    plugins: [admin(), anonymous()],
})
```

### [Run the migration](https://www.better-auth.com/docs/guides/supabase-migration-guide\#run-the-migration)

Run the migration to create the necessary tables in your database.

Terminal

```
npx @better-auth/cli migrate
```

This will create the following tables in your database:

- [`user`](https://www.better-auth.com/docs/concepts/database#user)
- [`account`](https://www.better-auth.com/docs/concepts/database#account)
- [`session`](https://www.better-auth.com/docs/concepts/database#session)
- [`verification`](https://www.better-auth.com/docs/concepts/database#verification)

This tables will be created on the `public` schema.

### [Copy the migration script](https://www.better-auth.com/docs/guides/supabase-migration-guide\#copy-the-migration-script)

Now that we have the necessary tables in our database, we can run the migration script to migrate the users and accounts from Supabase to Better Auth.

Start by creating a `.ts` file in your project.

Terminal

```
touch migration.ts
```

And then copy and paste the following code into the file.

migration.ts

```
import { Pool } from "pg";
import { auth } from "./auth";
import { User as SupabaseUser } from "@supabase/supabase-js";

type User = SupabaseUser & {
	is_super_admin: boolean;
	raw_user_meta_data: {
		avatar_url: string;
	};
	encrypted_password: string;
	email_confirmed_at: string;
	created_at: string;
	updated_at: string;
	is_anonymous: boolean;
	identities: {
		provider: string;
		identity_data: {
			sub: string;
			email: string;
		};
		created_at: string;
		updated_at: string;
	};
};

const migrateFromSupabase = async () => {
	const ctx = await auth.$context;
	const db = ctx.options.database as Pool;
	const users = await db
		.query(`
			SELECT
				u.*,
				COALESCE(
					json_agg(
						i.* ORDER BY i.id
					) FILTER (WHERE i.id IS NOT NULL),
					'[]'::json
				) as identities
			FROM auth.users u
			LEFT JOIN auth.identities i ON u.id = i.user_id
			GROUP BY u.id
		`)
		.then((res) => res.rows as User[]);
	for (const user of users) {
		if (!user.email) {
			continue;
		}
		await ctx.adapter
			.create({
				model: "user",
				data: {
					id: user.id,
					email: user.email,
					name: user.email,
					role: user.is_super_admin ? "admin" : user.role,
					emailVerified: !!user.email_confirmed_at,
					image: user.raw_user_meta_data.avatar_url,
					createdAt: new Date(user.created_at),
					updatedAt: new Date(user.updated_at),
					isAnonymous: user.is_anonymous,
				},
			})
			.catch(() => {});
		for (const identity of user.identities) {
			const existingAccounts = await ctx.internalAdapter.findAccounts(user.id);

			if (identity.provider === "email") {
				const hasCredential = existingAccounts.find(
					(account) => account.providerId === "credential",
				);
				if (!hasCredential) {
					await ctx.adapter
						.create({
							model: "account",
							data: {
								userId: user.id,
								providerId: "credential",
								accountId: user.id,
								password: user.encrypted_password,
								createdAt: new Date(user.created_at),
								updatedAt: new Date(user.updated_at),
							},
						})
						.catch(() => {});
				}
			}
			const supportedProviders = Object.keys(ctx.options.socialProviders || {})
			if (supportedProviders.includes(identity.provider)) {
				const hasAccount = existingAccounts.find(
					(account) => account.providerId === identity.provider,
				);
				if (!hasAccount) {
					await ctx.adapter.create({
						model: "account",
						data: {
							userId: user.id,
							providerId: identity.provider,
							accountId: identity.identity_data?.sub,
							createdAt: new Date(identity.created_at ?? user.created_at),
							updatedAt: new Date(identity.updated_at ?? user.updated_at),
						},
					});
				}
			}
		}
	}
};
migrateFromSupabase();
```

### [Customize the migration script (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide\#customize-the-migration-script-optional)

- `name`: the migration script will use the user's email as the name. You might want to customize it if you have the user display name in your database.
- `socialProviderList`: the migration script will use the social providers you have enabled in your auth config. You might want to customize it if you have additional social providers that you haven't enabled in your auth config.
- `role`: remove `role` if you're not using the `admin` plugin
- `isAnonymous`: remove `isAnonymous` if you're not using the `anonymous` plugin.
- update other tables that reference the `users` table to use the `id` field.

### [Run the migration script](https://www.better-auth.com/docs/guides/supabase-migration-guide\#run-the-migration-script)

Run the migration script to migrate the users and accounts from Supabase to Better Auth.

Terminal

```
bun migration.ts # or use node, ts-node, etc.
```

### [Update your code](https://www.better-auth.com/docs/guides/supabase-migration-guide\#update-your-code)

Update your codebase from Supabase auth calls to Better Auth API.

Here's a list of the Supabase auth API calls and their Better Auth counterparts.

- `supabase.auth.signUp` -\> `authClient.signUp.email`
- `supabase.auth.signInWithPassword` -\> `authClient.signIn.email`
- `supabase.auth.signInWithOAuth` -\> `authClient.signIn.social`
- `supabase.auth.signInAnonymously` -\> `authClient.signIn.anonymous`
- `supabase.auth.signOut` -\> `authClient.signOut`
- `supabase.auth.getSession` -\> `authClient.getSession` \- you can also use `authClient.useSession` for reactive state

Learn more:

- [Basic Usage](https://www.better-auth.com/docs/basic-usage): Learn how to use the auth client to sign up, sign in, and sign out.
- [Email and Password](https://www.better-auth.com/docs/authentication/email-and-password): Learn how to add email and password authentication to your project.
- [Anonymous](https://www.better-auth.com/docs/plugins/anonymous): Learn how to add anonymous authentication to your project.
- [Admin](https://www.better-auth.com/docs/plugins/admin): Learn how to add admin authentication to your project.
- [Email OTP](https://www.better-auth.com/docs/authentication/email-otp): Learn how to add email OTP authentication to your project.
- [Hooks](https://www.better-auth.com/docs/concepts/hooks): Learn how to use the hooks to listen for events.
- [Next.js](https://www.better-auth.com/docs/integrations/next): Learn how to use the auth client in a Next.js project.

### [Middleware](https://www.better-auth.com/docs/guides/supabase-migration-guide\#middleware)

To protect routes with middleware, refer to the [Next.js middleware guide](https://www.better-auth.com/docs/integrations/next#middleware) or your framework's documentation.

## [Wrapping Up](https://www.better-auth.com/docs/guides/supabase-migration-guide\#wrapping-up)

Congratulations! You've successfully migrated from Supabase Auth to Better Auth.

Better Auth offers greater flexibility and more features—be sure to explore the [documentation](https://www.better-auth.com/docs) to unlock its full potential.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/supabase-migration-guide.mdx)

[Previous Page\\
\\
Next Auth Migration Guide](https://www.better-auth.com/docs/guides/next-auth-migration-guide) [Next Page\\
\\
Clerk Migration Guide](https://www.better-auth.com/docs/guides/clerk-migration-guide)

### On this page

[Before You Begin](https://www.better-auth.com/docs/guides/supabase-migration-guide#before-you-begin) [Connect to your database](https://www.better-auth.com/docs/guides/supabase-migration-guide#connect-to-your-database) [Enable Email and Password (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide#enable-email-and-password-optional) [Setup Social Providers (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide#setup-social-providers-optional) [Add admin and anonymous plugins (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide#add-admin-and-anonymous-plugins-optional) [Run the migration](https://www.better-auth.com/docs/guides/supabase-migration-guide#run-the-migration) [Copy the migration script](https://www.better-auth.com/docs/guides/supabase-migration-guide#copy-the-migration-script) [Customize the migration script (Optional)](https://www.better-auth.com/docs/guides/supabase-migration-guide#customize-the-migration-script-optional) [Run the migration script](https://www.better-auth.com/docs/guides/supabase-migration-guide#run-the-migration-script) [Update your code](https://www.better-auth.com/docs/guides/supabase-migration-guide#update-your-code) [Middleware](https://www.better-auth.com/docs/guides/supabase-migration-guide#middleware) [Wrapping Up](https://www.better-auth.com/docs/guides/supabase-migration-guide#wrapping-up)