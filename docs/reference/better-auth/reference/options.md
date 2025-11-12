---
title: Options | Better Auth
url: 
description: Better Auth configuration options reference.
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

# Options

Copy MarkdownOpen in

List of all the available options for configuring Better Auth. See [Better Auth Options](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/types/options.ts#L13).

## [`appName`](https://www.better-auth.com/docs/reference/options\#appname)

The name of the application.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	appName: "My App",
})
```

## [`baseURL`](https://www.better-auth.com/docs/reference/options\#baseurl)

Base URL for Better Auth. This is typically the root URL where your application server is hosted. Note: If you include a path in the baseURL, it will take precedence over the default path.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	baseURL: "https://example.com",
})
```

If not explicitly set, the system will check for the environment variable `process.env.BETTER_AUTH_URL`

## [`basePath`](https://www.better-auth.com/docs/reference/options\#basepath)

Base path for Better Auth. This is typically the path where the Better Auth routes are mounted. It will be overridden if there is a path component within `baseURL`.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	basePath: "/api/auth",
})
```

Default: `/api/auth`

## [`trustedOrigins`](https://www.better-auth.com/docs/reference/options\#trustedorigins)

List of trusted origins. You can provide a static array of origins, a function that returns origins dynamically, or use wildcard patterns to match multiple domains.

### [Static Origins](https://www.better-auth.com/docs/reference/options\#static-origins)

You can provide a static array of origins:

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	trustedOrigins: ["http://localhost:3000", "https://example.com"],
})
```

### [Dynamic Origins](https://www.better-auth.com/docs/reference/options\#dynamic-origins)

You can provide a function that returns origins dynamically:

```
export const auth = betterAuth({
	trustedOrigins: async (request: Request) => {
		// Return an array of trusted origins based on the request
		return ["https://dynamic-origin.com"];
	}
})
```

### [Wildcard Support](https://www.better-auth.com/docs/reference/options\#wildcard-support)

You can use wildcard patterns in trusted origins:

```
export const auth = betterAuth({
	trustedOrigins: [\
		"*.example.com",             // Trust all subdomains of example.com\
		"https://*.example.com",     // Trust only HTTPS subdomains\
		"http://*.dev.example.com"   // Trust HTTP subdomains of dev.example.com\
	]
})
```

## [`secret`](https://www.better-auth.com/docs/reference/options\#secret)

The secret used for encryption, signing, and hashing.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	secret: "your-secret-key",
})
```

By default, Better Auth will look for the following environment variables:

- `process.env.BETTER_AUTH_SECRET`
- `process.env.AUTH_SECRET`

If none of these environment variables are set, it will default to `"better-auth-secret-123456789"`. In production, if it's not set, it will throw an error.

You can generate a good secret using the following command:

```
openssl rand -base64 32
```

## [`database`](https://www.better-auth.com/docs/reference/options\#database)

Database configuration for Better Auth.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	database: {
		dialect: "postgres",
		type: "postgres",
		casing: "camel"
	},
})
```

Better Auth supports various database configurations including [PostgreSQL](https://www.better-auth.com/docs/adapters/postgresql), [MySQL](https://www.better-auth.com/docs/adapters/mysql), and [SQLite](https://www.better-auth.com/docs/adapters/sqlite).

Read more about databases [here](https://www.better-auth.com/docs/concepts/database).

## [`secondaryStorage`](https://www.better-auth.com/docs/reference/options\#secondarystorage)

Secondary storage configuration used to store session and rate limit data.

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
	// ... other options
    secondaryStorage: {
    	// Your implementation here
    },
})
```

Read more about secondary storage [here](https://www.better-auth.com/docs/concepts/database#secondary-storage).

## [`emailVerification`](https://www.better-auth.com/docs/reference/options\#emailverification)

Email verification configuration.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	emailVerification: {
		sendVerificationEmail: async ({ user, url, token }) => {
			// Send verification email to user
		},
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		expiresIn: 3600 // 1 hour
	},
})
```

- `sendVerificationEmail`: Function to send verification email
- `sendOnSignUp`: Send verification email automatically after sign up (default: `false`)
- `sendOnSignIn`: Send verification email automatically on sign in when the user's email is not verified (default: `false`)
- `autoSignInAfterVerification`: Auto sign in the user after they verify their email
- `expiresIn`: Number of seconds the verification token is valid for (default: `3600` seconds)

## [`emailAndPassword`](https://www.better-auth.com/docs/reference/options\#emailandpassword)

Email and password authentication configuration.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	emailAndPassword: {
		enabled: true,
		disableSignUp: false,
		requireEmailVerification: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		autoSignIn: true,
		sendResetPassword: async ({ user, url, token }) => {
			// Send reset password email
		},
		resetPasswordTokenExpiresIn: 3600, // 1 hour
		password: {
			hash: async (password) => {
				// Custom password hashing
				return hashedPassword;
			},
			verify: async ({ hash, password }) => {
				// Custom password verification
				return isValid;
			}
		}
	},
})
```

- `enabled`: Enable email and password authentication (default: `false`)
- `disableSignUp`: Disable email and password sign up (default: `false`)
- `requireEmailVerification`: Require email verification before a session can be created
- `minPasswordLength`: Minimum password length (default: `8`)
- `maxPasswordLength`: Maximum password length (default: `128`)
- `autoSignIn`: Automatically sign in the user after sign up
- `sendResetPassword`: Function to send reset password email
- `resetPasswordTokenExpiresIn`: Number of seconds the reset password token is valid for (default: `3600` seconds)
- `password`: Custom password hashing and verification functions

## [`socialProviders`](https://www.better-auth.com/docs/reference/options\#socialproviders)

Configure social login providers.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	socialProviders: {
		google: {
			clientId: "your-client-id",
			clientSecret: "your-client-secret",
			redirectUri: "https://example.com/api/auth/callback/google"
		},
		github: {
			clientId: "your-client-id",
			clientSecret: "your-client-secret",
			redirectUri: "https://example.com/api/auth/callback/github"
		}
	},
})
```

## [`plugins`](https://www.better-auth.com/docs/reference/options\#plugins)

List of Better Auth plugins.

```
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";

export const auth = betterAuth({
	plugins: [\
		emailOTP({\
			sendVerificationOTP: async ({ email, otp, type }) => {\
				// Send OTP to user's email\
			}\
		})\
	],
})
```

## [`user`](https://www.better-auth.com/docs/reference/options\#user)

User configuration options.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	user: {
		modelName: "users",
		fields: {
			email: "emailAddress",
			name: "fullName"
		},
		additionalFields: {
			customField: {
				type: "string",
			}
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async ({ user, newEmail, url, token }) => {
				// Send change email verification
			}
		},
		deleteUser: {
			enabled: true,
			sendDeleteAccountVerification: async ({ user, url, token }) => {
				// Send delete account verification
			},
			beforeDelete: async (user) => {
				// Perform actions before user deletion
			},
			afterDelete: async (user) => {
				// Perform cleanup after user deletion
			}
		}
	},
})
```

- `modelName`: The model name for the user (default: `"user"`)
- `fields`: Map fields to different column names
- `additionalFields`: Additional fields for the user table
- `changeEmail`: Configuration for changing email
- `deleteUser`: Configuration for user deletion

## [`session`](https://www.better-auth.com/docs/reference/options\#session)

Session configuration options.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	session: {
		modelName: "sessions",
		fields: {
			userId: "user_id"
		},
		expiresIn: 604800, // 7 days
		updateAge: 86400, // 1 day
		disableSessionRefresh: true, // Disable session refresh so that the session is not updated regardless of the `updateAge` option. (default: `false`)
		additionalFields: { // Additional fields for the session table
			customField: {
				type: "string",
			}
		},
		storeSessionInDatabase: true, // Store session in database when secondary storage is provided (default: `false`)
		preserveSessionInDatabase: false, // Preserve session records in database when deleted from secondary storage (default: `false`)
		cookieCache: {
			enabled: true, // Enable caching session in cookie (default: `false`)
			maxAge: 300 // 5 minutes
		}
	},
})
```

- `modelName`: The model name for the session (default: `"session"`)
- `fields`: Map fields to different column names
- `expiresIn`: Expiration time for the session token in seconds (default: `604800` \- 7 days)
- `updateAge`: How often the session should be refreshed in seconds (default: `86400` \- 1 day)
- `additionalFields`: Additional fields for the session table
- `storeSessionInDatabase`: Store session in database when secondary storage is provided (default: `false`)
- `preserveSessionInDatabase`: Preserve session records in database when deleted from secondary storage (default: `false`)
- `cookieCache`: Enable caching session in cookie

## [`account`](https://www.better-auth.com/docs/reference/options\#account)

Account configuration options.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	account: {
		modelName: "accounts",
		fields: {
			userId: "user_id"
		},
		encryptOAuthTokens: true, // Encrypt OAuth tokens before storing them in the database
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "github", "email-password"],
			allowDifferentEmails: false
		}
	},
})
```

- `modelName`: The model name for the account
- `fields`: Map fields to different column names

### [`encryptOAuthTokens`](https://www.better-auth.com/docs/reference/options\#encryptoauthtokens)

Encrypt OAuth tokens before storing them in the database. Default: `false`.

### [`updateAccountOnSignIn`](https://www.better-auth.com/docs/reference/options\#updateaccountonsignin)

If enabled (true), the user account data (accessToken, idToken, refreshToken, etc.)
will be updated on sign in with the latest data from the provider.

### [`accountLinking`](https://www.better-auth.com/docs/reference/options\#accountlinking)

Configuration for account linking.

- `enabled`: Enable account linking (default: `false`)
- `trustedProviders`: List of trusted providers
- `allowDifferentEmails`: Allow users to link accounts with different email addresses
- `allowUnlinkingAll`: Allow users to unlink all accounts

## [`verification`](https://www.better-auth.com/docs/reference/options\#verification)

Verification configuration options.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	verification: {
		modelName: "verifications",
		fields: {
			userId: "user_id"
		},
		disableCleanup: false
	},
})
```

- `modelName`: The model name for the verification table
- `fields`: Map fields to different column names
- `disableCleanup`: Disable cleaning up expired values when a verification value is fetched

## [`rateLimit`](https://www.better-auth.com/docs/reference/options\#ratelimit)

Rate limiting configuration.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
		customRules: {
			"/example/path": {
				window: 10,
				max: 100
			}
		},
		storage: "memory",
		modelName: "rateLimit"
	}
})
```

- `enabled`: Enable rate limiting (defaults: `true` in production, `false` in development)
- `window`: Time window to use for rate limiting. The value should be in seconds. (default: `10`)
- `max`: The default maximum number of requests allowed within the window. (default: `100`)
- `customRules`: Custom rate limit rules to apply to specific paths.
- `storage`: Storage configuration. If you passed a secondary storage, rate limiting will be stored in the secondary storage. (options: `"memory", "database", "secondary-storage"`, default: `"memory"`)
- `modelName`: The name of the table to use for rate limiting if database is used as storage. (default: `"rateLimit"`)

## [`advanced`](https://www.better-auth.com/docs/reference/options\#advanced)

Advanced configuration options.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	advanced: {
		ipAddress: {
			ipAddressHeaders: ["x-client-ip", "x-forwarded-for"],
			disableIpTracking: false
		},
		useSecureCookies: true,
		disableCSRFCheck: false,
		crossSubDomainCookies: {
			enabled: true,
			additionalCookies: ["custom_cookie"],
			domain: "example.com"
		},
		cookies: {
			session_token: {
				name: "custom_session_token",
				attributes: {
					httpOnly: true,
					secure: true
				}
			}
		},
		defaultCookieAttributes: {
			httpOnly: true,
			secure: true
		},
		cookiePrefix: "myapp",
		database: {
			// If your DB is using auto-incrementing IDs, set this to true.
			useNumberId: false,
			// Use your own custom ID generator, or disable generating IDs as a whole.
			generateId: (((options: {
				model: LiteralUnion<Models, string>;
				size?: number;
			}) => {
				return "my-super-unique-id";
			})) | false,
			defaultFindManyLimit: 100,
		}
	},
})
```

- `ipAddress`: IP address configuration for rate limiting and session tracking
- `useSecureCookies`: Use secure cookies (default: `false`)
- `disableCSRFCheck`: Disable trusted origins check (⚠️ security risk)
- `crossSubDomainCookies`: Configure cookies to be shared across subdomains
- `cookies`: Customize cookie names and attributes
- `defaultCookieAttributes`: Default attributes for all cookies
- `cookiePrefix`: Prefix for cookies
- `generateId`: Function to generate a unique ID for a model

## [`logger`](https://www.better-auth.com/docs/reference/options\#logger)

Logger configuration for Better Auth.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	logger: {
		disabled: false,
		disableColors: false,
		level: "error",
		log: (level, message, ...args) => {
			// Custom logging implementation
			console.log(`[${level}] ${message}`, ...args);
		}
	}
})
```

The logger configuration allows you to customize how Better Auth handles logging. It supports the following options:

- `disabled`: Disable all logging when set to `true` (default: `false`)
- `disableColors`: Disable colors in the default logger implementation (default: determined by the terminal's color support)
- `level`: Set the minimum log level to display. Available levels are:
  - `"info"`: Show all logs
  - `"warn"`: Show warnings and errors
  - `"error"`: Show only errors
  - `"debug"`: Show all logs including debug information
- `log`: Custom logging function that receives:
  - `level`: The log level ( `"info"`, `"warn"`, `"error"`, or `"debug"`)
  - `message`: The log message
  - `...args`: Additional arguments passed to the logger

Example with custom logging:

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	logger: {
		level: "info",
		log: (level, message, ...args) => {
			// Send logs to a custom logging service
			myLoggingService.log({
				level,
				message,
				metadata: args,
				timestamp: new Date().toISOString()
			});
		}
	}
})
```

## [`databaseHooks`](https://www.better-auth.com/docs/reference/options\#databasehooks)

Database lifecycle hooks for core operations.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					// Modify user data before creation
					return { data: { ...user, customField: "value" } };
				},
				after: async (user) => {
					// Perform actions after user creation
				}
			},
			update: {
				before: async (userData) => {
					// Modify user data before update
					return { data: { ...userData, updatedAt: new Date() } };
				},
				after: async (user) => {
					// Perform actions after user update
				}
			}
		},
		session: {
			// Session hooks
		},
		account: {
			// Account hooks
		},
		verification: {
			// Verification hooks
		}
	},
})
```

## [`onAPIError`](https://www.better-auth.com/docs/reference/options\#onapierror)

API error handling configuration.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	onAPIError: {
		throw: true,
		onError: (error, ctx) => {
			// Custom error handling
			console.error("Auth error:", error);
		},
		errorURL: "/auth/error"
	},
})
```

- `throw`: Throw an error on API error (default: `false`)
- `onError`: Custom error handler
- `errorURL`: URL to redirect to on error (default: `/api/auth/error`)

## [`hooks`](https://www.better-auth.com/docs/reference/options\#hooks)

Request lifecycle hooks.

```
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";

export const auth = betterAuth({
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			// Execute before processing the request
			console.log("Request path:", ctx.path);
		}),
		after: createAuthMiddleware(async (ctx) => {
			// Execute after processing the request
			console.log("Response:", ctx.context.returned);
		})
	},
})
```

For more details and examples, see the [Hooks documentation](https://www.better-auth.com/docs/concepts/hooks).

## [`disabledPaths`](https://www.better-auth.com/docs/reference/options\#disabledpaths)

Disable specific auth paths.

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
	disabledPaths: ["/sign-up/email", "/sign-in/email"],
})
```

## [`telemetry`](https://www.better-auth.com/docs/reference/options\#telemetry)

Enable or disable Better Auth's telemetry collection. (default: `false`)

```
import { betterAuth } from "better-auth";
export const auth = betterAuth({
  telemetry: {
    enabled: false,
  }
})
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/reference/options.mdx)

[Previous Page\\
\\
Optimize for Performance](https://www.better-auth.com/docs/guides/optimizing-for-performance) [Next Page\\
\\
Contributing](https://www.better-auth.com/docs/reference/contributing)

### On this page

[`appName`](https://www.better-auth.com/docs/reference/options#appname) [`baseURL`](https://www.better-auth.com/docs/reference/options#baseurl) [`basePath`](https://www.better-auth.com/docs/reference/options#basepath) [`trustedOrigins`](https://www.better-auth.com/docs/reference/options#trustedorigins) [Static Origins](https://www.better-auth.com/docs/reference/options#static-origins) [Dynamic Origins](https://www.better-auth.com/docs/reference/options#dynamic-origins) [Wildcard Support](https://www.better-auth.com/docs/reference/options#wildcard-support) [`secret`](https://www.better-auth.com/docs/reference/options#secret) [`database`](https://www.better-auth.com/docs/reference/options#database) [`secondaryStorage`](https://www.better-auth.com/docs/reference/options#secondarystorage) [`emailVerification`](https://www.better-auth.com/docs/reference/options#emailverification) [`emailAndPassword`](https://www.better-auth.com/docs/reference/options#emailandpassword) [`socialProviders`](https://www.better-auth.com/docs/reference/options#socialproviders) [`plugins`](https://www.better-auth.com/docs/reference/options#plugins) [`user`](https://www.better-auth.com/docs/reference/options#user) [`session`](https://www.better-auth.com/docs/reference/options#session) [`account`](https://www.better-auth.com/docs/reference/options#account) [`encryptOAuthTokens`](https://www.better-auth.com/docs/reference/options#encryptoauthtokens) [`updateAccountOnSignIn`](https://www.better-auth.com/docs/reference/options#updateaccountonsignin) [`accountLinking`](https://www.better-auth.com/docs/reference/options#accountlinking) [`verification`](https://www.better-auth.com/docs/reference/options#verification) [`rateLimit`](https://www.better-auth.com/docs/reference/options#ratelimit) [`advanced`](https://www.better-auth.com/docs/reference/options#advanced) [`logger`](https://www.better-auth.com/docs/reference/options#logger) [`databaseHooks`](https://www.better-auth.com/docs/reference/options#databasehooks) [`onAPIError`](https://www.better-auth.com/docs/reference/options#onapierror) [`hooks`](https://www.better-auth.com/docs/reference/options#hooks) [`disabledPaths`](https://www.better-auth.com/docs/reference/options#disabledpaths) [`telemetry`](https://www.better-auth.com/docs/reference/options#telemetry)