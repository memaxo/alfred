---
title: Migrating from Clerk to Better Auth | Better Auth
url:
description: A step-by-step guide to transitioning from Clerk to Better Auth.
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

# Migrating from Clerk to Better Auth

Copy MarkdownOpen in

In this guide, we'll walk through the steps to migrate a project from Clerk to Better Auth — including email/password with proper hashing, social/external accounts, phone number, two-factor data, and more.

This migration will invalidate all active sessions. This guide doesn't currently show you how to migrate Organization but it should be possible with additional steps and the [Organization](https://www.better-auth.com/docs/plugins/organization) Plugin.

## [Before You Begin](https://www.better-auth.com/docs/guides/clerk-migration-guide#before-you-begin)

Before starting the migration process, set up Better Auth in your project. Follow the [installation guide](https://www.better-auth.com/docs/installation) to get started. And go to

### [Connect to your database](https://www.better-auth.com/docs/guides/clerk-migration-guide#connect-to-your-database)

You'll need to connect to your database to migrate the users and accounts. You can use any database you want, but for this example, we'll use PostgreSQL.

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

### [Enable Email and Password (Optional)](https://www.better-auth.com/docs/guides/clerk-migration-guide#enable-email-and-password-optional)

Enable the email and password in your auth config and implement your own logic for sending verification emails, reset password emails, etc.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL
    }),
    emailAndPassword: {
        enabled: true,
    },
    emailVerification: {
      sendVerificationEmail: async({ user, url })=>{
        // implement your logic here to send email verification
      }
	},
})
```

See [Email and Password](https://www.better-auth.com/docs/authentication/email-password) for more configuration options.

### [Setup Social Providers (Optional)](https://www.better-auth.com/docs/guides/clerk-migration-guide#setup-social-providers-optional)

Add social providers you have enabled in your Clerk project in your auth config.

auth.ts

```
import { betterAuth } from "better-auth";

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

### [Add Plugins (Optional)](https://www.better-auth.com/docs/guides/clerk-migration-guide#add-plugins-optional)

You can add the following plugins to your auth config based on your needs.

[Admin](https://www.better-auth.com/docs/plugins/admin) Plugin will allow you to manage users, user impersonations and app level roles and permissions.

[Two Factor](https://www.better-auth.com/docs/plugins/2fa) Plugin will allow you to add two-factor authentication to your application.

[Phone Number](https://www.better-auth.com/docs/plugins/phone-number) Plugin will allow you to add phone number authentication to your application.

[Username](https://www.better-auth.com/docs/plugins/username) Plugin will allow you to add username authentication to your application.

auth.ts

```
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { admin, twoFactor, phoneNumber, username } from "better-auth/plugins";

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
    plugins: [admin(), twoFactor(), phoneNumber(), username()],
})
```

### [Generate Schema](https://www.better-auth.com/docs/guides/clerk-migration-guide#generate-schema)

If you're using a custom database adapter, generate the schema:

```
npx @better-auth/cli generate
```

or if you're using the default adapter, you can use the following command:

```
npx @better-auth/cli migrate
```

### [Export Clerk Users](https://www.better-auth.com/docs/guides/clerk-migration-guide#export-clerk-users)

Go to the Clerk dashboard and export the users. Check how to do it [here](https://clerk.com/docs/deployments/exporting-users#export-your-users-data-from-the-clerk-dashboard). It will download a CSV file with the users data. You need to save it as `exported_users.csv` and put it in the root of your project.

### [Create the migration script](https://www.better-auth.com/docs/guides/clerk-migration-guide#create-the-migration-script)

Create a new file called `migrate-clerk.ts` in the `scripts` folder and add the following code:

scripts/migrate-clerk.ts

```
import { generateRandomString, symmetricEncrypt } from "better-auth/crypto";

import { auth } from "@/lib/auth"; // import your auth instance

function getCSVData(csv: string) {
  const lines = csv.split('\n').filter(line => line.trim());
  const headers = lines[0]?.split(',').map(header => header.trim()) || [];
  const jsonData = lines.slice(1).map(line => {
      const values = line.split(',').map(value => value.trim());
      return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
      }, {} as Record<string, string>);
  });

  return jsonData as Array<{
      id: string;
      first_name: string;
      last_name: string;
      username: string;
      primary_email_address: string;
      primary_phone_number: string;
      verified_email_addresses: string;
      unverified_email_addresses: string;
      verified_phone_numbers: string;
      unverified_phone_numbers: string;
      totp_secret: string;
      password_digest: string;
      password_hasher: string;
  }>;
}

const exportedUserCSV = await Bun.file("exported_users.csv").text(); // this is the file you downloaded from Clerk

async function getClerkUsers(totalUsers: number) {
  const clerkUsers: {
      id: string;
      first_name: string;
      last_name: string;
      username: string;
      image_url: string;
      password_enabled: boolean;
      two_factor_enabled: boolean;
      totp_enabled: boolean;
      backup_code_enabled: boolean;
      banned: boolean;
      locked: boolean;
      lockout_expires_in_seconds: number;
      created_at: number;
      updated_at: number;
      external_accounts: {
          id: string;
          provider: string;
          identification_id: string;
          provider_user_id: string;
          approved_scopes: string;
          email_address: string;
          first_name: string;
          last_name: string;
          image_url: string;
          created_at: number;
          updated_at: number;
      }[]
  }[] = [];
  for (let i = 0; i < totalUsers; i += 500) {
      const response = await fetch(`https://api.clerk.com/v1/users?offset=${i}&limit=${500}`, {
          headers: {
              'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`
          }
      });
      if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
      }
      const clerkUsersData = await response.json();
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      clerkUsers.push(...clerkUsersData as any);
  }
  return clerkUsers;
}

export async function generateBackupCodes(
  secret: string,
) {
  const key = secret;
  const backupCodes = Array.from({ length: 10 })
      .fill(null)
      .map(() => generateRandomString(10, "a-z", "0-9", "A-Z"))
      .map((code) => `${code.slice(0, 5)}-${code.slice(5)}`);
  const encCodes = await symmetricEncrypt({
      data: JSON.stringify(backupCodes),
      key: key,
  });
  return encCodes
}

// Helper function to safely convert timestamp to Date
function safeDateConversion(timestamp?: number): Date {
  if (!timestamp) return new Date();

  // Convert seconds to milliseconds
  const date = new Date(timestamp * 1000);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
      console.warn(`Invalid timestamp: ${timestamp}, falling back to current date`);
      return new Date();
  }

  // Check for unreasonable dates (before 2000 or after 2100)
  const year = date.getFullYear();
  if (year < 2000 || year > 2100) {
      console.warn(`Suspicious date year: ${year}, falling back to current date`);
      return new Date();
  }

  return date;
}

async function migrateFromClerk() {
  const jsonData = getCSVData(exportedUserCSV);
  const clerkUsers = await getClerkUsers(jsonData.length);
  const ctx = await auth.$context
  const isAdminEnabled = ctx.options?.plugins?.find(plugin => plugin.id === "admin");
  const isTwoFactorEnabled = ctx.options?.plugins?.find(plugin => plugin.id === "two-factor");
  const isUsernameEnabled = ctx.options?.plugins?.find(plugin => plugin.id === "username");
  const isPhoneNumberEnabled = ctx.options?.plugins?.find(plugin => plugin.id === "phone-number");
  for (const user of jsonData) {
      const { id, first_name, last_name, username, primary_email_address, primary_phone_number, verified_email_addresses, unverified_email_addresses, verified_phone_numbers, unverified_phone_numbers, totp_secret, password_digest, password_hasher } = user;
      const clerkUser = clerkUsers.find(clerkUser => clerkUser?.id === id);

      // create user
      const createdUser = await ctx.adapter.create<{
          id: string;
      }>({
          model: "user",
          data: {
              id,
              email: primary_email_address,
              emailVerified: verified_email_addresses.length > 0,
              name: `${first_name} ${last_name}`,
              image: clerkUser?.image_url,
              createdAt: safeDateConversion(clerkUser?.created_at),
              updatedAt: safeDateConversion(clerkUser?.updated_at),
              // # Two Factor (if you enabled two factor plugin)
              ...(isTwoFactorEnabled ? {
                  twoFactorEnabled: clerkUser?.two_factor_enabled
              } : {}),
              // # Admin (if you enabled admin plugin)
              ...(isAdminEnabled ? {
                  banned: clerkUser?.banned,
                  banExpiresAt: clerkUser?.lockout_expires_in_seconds,
                  role: "user"
              } : {}),
              // # Username (if you enabled username plugin)
              ...(isUsernameEnabled ? {
                  username: username,
              } : {}),
              // # Phone Number (if you enabled phone number plugin)
              ...(isPhoneNumberEnabled ? {
                  phoneNumber: primary_phone_number,
                  phoneNumberVerified: verified_phone_numbers.length > 0,
              } : {}),
          },
          forceAllowId: true
      }).catch(async e => {
          return await ctx.adapter.findOne<{
              id: string;
          }>({
              model: "user",
              where: [{\
                  field: "id",\
                  value: id\
              }]
          })
      })
      // create external account
      const externalAccounts = clerkUser?.external_accounts;
      if (externalAccounts) {
          for (const externalAccount of externalAccounts) {
              const { id, provider, identification_id, provider_user_id, approved_scopes, email_address, first_name, last_name, image_url, created_at, updated_at } = externalAccount;
              if (externalAccount.provider === "credential") {
                  await ctx.adapter.create({
                      model: "account",
                      data: {
                          id,
                          providerId: provider,
                          accountId: externalAccount.provider_user_id,
                          scope: approved_scopes,
                          userId: createdUser?.id,
                          createdAt: safeDateConversion(created_at),
                          updatedAt: safeDateConversion(updated_at),
                          password: password_digest,
                      }
                  })
              } else {
                  await ctx.adapter.create({
                      model: "account",
                      data: {
                          id,
                          providerId: provider.replace("oauth_", ""),
                          accountId: externalAccount.provider_user_id,
                          scope: approved_scopes,
                          userId: createdUser?.id,
                          createdAt: safeDateConversion(created_at),
                          updatedAt: safeDateConversion(updated_at),
                      },
                      forceAllowId: true
                  })
              }
          }
      }

      //two factor
      if (isTwoFactorEnabled) {
          await ctx.adapter.create({
              model: "twoFactor",
              data: {
                  userId: createdUser?.id,
                  secret: totp_secret,
                  backupCodes: await generateBackupCodes(totp_secret)
              }
          })
      }
  }
}

migrateFromClerk()
  .then(() => {
      console.log('Migration completed');
      process.exit(0);
  })
  .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
  });
```

Make sure to replace the `process.env.CLERK_SECRET_KEY` with your own Clerk secret key. Feel free to customize the script to your needs.

### [Run the migration](https://www.better-auth.com/docs/guides/clerk-migration-guide#run-the-migration)

Run the migration:

```
bun run script/migrate-clerk.ts # you can use any thing you like to run the script
```

Make sure to:

1. Test the migration in a development environment first
2. Monitor the migration process for any errors
3. Verify the migrated data in Better Auth before proceeding
4. Keep Clerk installed and configured until the migration is complete

### [Verify the migration](https://www.better-auth.com/docs/guides/clerk-migration-guide#verify-the-migration)

After running the migration, verify that all users have been properly migrated by checking the database.

### [Update your components](https://www.better-auth.com/docs/guides/clerk-migration-guide#update-your-components)

Now that the data is migrated, you can start updating your components to use Better Auth. Here's an example for the sign-in component:

components/auth/sign-in.tsx

```
import { authClient } from "better-auth/client";

export const SignIn = () => {
  const handleSignIn = async () => {
    const { data, error } = await authClient.signIn.email({
      email: "user@example.com",
      password: "password",
    });

    if (error) {
      console.error(error);
      return;
    }
    // Handle successful sign in
  };

  return (
    <form onSubmit={handleSignIn}>
      <button type="submit">Sign in</button>
    </form>
  );
};
```

### [Update the middleware](https://www.better-auth.com/docs/guides/clerk-migration-guide#update-the-middleware)

Replace your Clerk middleware with Better Auth's middleware:

middleware.ts

```

import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;
  if (sessionCookie && ["/login", "/signup"].includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!sessionCookie && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/login", "/signup"],
};
```

### [Remove Clerk Dependencies](https://www.better-auth.com/docs/guides/clerk-migration-guide#remove-clerk-dependencies)

Once you've verified that everything is working correctly with Better Auth, you can remove Clerk:

Remove Clerk

```
pnpm remove @clerk/nextjs @clerk/themes @clerk/types
```

## [Additional Resources](https://www.better-auth.com/docs/guides/clerk-migration-guide#additional-resources)

[Goodbye Clerk, Hello Better Auth – Full Migration Guide!](https://www.youtube.com/watch?v=Za_QihbDSuk)

## [Wrapping Up](https://www.better-auth.com/docs/guides/clerk-migration-guide#wrapping-up)

Congratulations! You've successfully migrated from Clerk to Better Auth.

Better Auth offers greater flexibility and more features—be sure to explore the [documentation](https://www.better-auth.com/docs) to unlock its full potential.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/clerk-migration-guide.mdx)

[Previous Page\\
\\
Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide) [Next Page\\
\\
Auth0 Migration Guide](https://www.better-auth.com/docs/guides/auth0-migration-guide)

### On this page

[Before You Begin](https://www.better-auth.com/docs/guides/clerk-migration-guide#before-you-begin) [Connect to your database](https://www.better-auth.com/docs/guides/clerk-migration-guide#connect-to-your-database) [Enable Email and Password (Optional)](https://www.better-auth.com/docs/guides/clerk-migration-guide#enable-email-and-password-optional) [Setup Social Providers (Optional)](https://www.better-auth.com/docs/guides/clerk-migration-guide#setup-social-providers-optional) [Add Plugins (Optional)](https://www.better-auth.com/docs/guides/clerk-migration-guide#add-plugins-optional) [Generate Schema](https://www.better-auth.com/docs/guides/clerk-migration-guide#generate-schema) [Export Clerk Users](https://www.better-auth.com/docs/guides/clerk-migration-guide#export-clerk-users) [Create the migration script](https://www.better-auth.com/docs/guides/clerk-migration-guide#create-the-migration-script) [Run the migration](https://www.better-auth.com/docs/guides/clerk-migration-guide#run-the-migration) [Verify the migration](https://www.better-auth.com/docs/guides/clerk-migration-guide#verify-the-migration) [Update your components](https://www.better-auth.com/docs/guides/clerk-migration-guide#update-your-components) [Update the middleware](https://www.better-auth.com/docs/guides/clerk-migration-guide#update-the-middleware) [Remove Clerk Dependencies](https://www.better-auth.com/docs/guides/clerk-migration-guide#remove-clerk-dependencies) [Additional Resources](https://www.better-auth.com/docs/guides/clerk-migration-guide#additional-resources) [Wrapping Up](https://www.better-auth.com/docs/guides/clerk-migration-guide#wrapping-up)
