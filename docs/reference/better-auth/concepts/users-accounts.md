---
title: User & Accounts | Better Auth
url:
description: User and account management.
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

# User & Accounts

Copy MarkdownOpen in

Beyond authenticating users, Better Auth also provides a set of methods to manage users. This includes, updating user information, changing passwords, and more.

The user table stores the authentication data of the user [Click here to view the schema](https://www.better-auth.com/docs/concepts/database#user).

The user table can be extended using [additional fields](https://www.better-auth.com/docs/concepts/database#extending-core-schema) or by plugins to store additional data.

## [Update User](https://www.better-auth.com/docs/concepts/users-accounts#update-user)

### [Update User Information](https://www.better-auth.com/docs/concepts/users-accounts#update-user-information)

To update user information, you can use the `updateUser` function provided by the client. The `updateUser` function takes an object with the following properties:

```
await authClient.updateUser({
    image: "https://example.com/image.jpg",
    name: "John Doe",
})
```

### [Change Email](https://www.better-auth.com/docs/concepts/users-accounts#change-email)

To allow users to change their email, first enable the `changeEmail` feature, which is disabled by default. Set `changeEmail.enabled` to `true`:

```
export const auth = betterAuth({
    user: {
        changeEmail: {
            enabled: true,
        }
    }
})
```

For users with a verified email, provide the `sendChangeEmailVerification` function. This function triggers when a user changes their email, sending a verification email with a URL and token. If the current email isn't verified, the change happens immediately without verification.

```
export const auth = betterAuth({
    user: {
        changeEmail: {
            enabled: true,
            sendChangeEmailVerification: async ({ user, newEmail, url, token }, request) => {
                await sendEmail({
                    to: user.email, // verification email must be sent to the current user email to approve the change
                    subject: 'Approve email change',
                    text: `Click the link to approve the change: ${url}`
                })
            }
        }
    }
})
```

Once enabled, use the `changeEmail` function on the client to update a user’s email. The user must verify their current email before changing it.

```
await authClient.changeEmail({
    newEmail: "new-email@email.com",
    callbackURL: "/dashboard", //to redirect after verification
});
```

After verification, the new email is updated in the user table, and a confirmation is sent to the new address.

If the current email is unverified, the new email is updated without the verification step.

### [Change Password](https://www.better-auth.com/docs/concepts/users-accounts#change-password)

A user's password isn't stored in the user table. Instead, it's stored in the account table. To change the password of a user, you can use one of the following approaches:

ClientServer

POST

/change-password

```
const { data, error } = await authClient.changePassword({
    newPassword: "newpassword1234", // required
    currentPassword: "oldpassword1234", // required
    revokeOtherSessions: true,
});
```

| Prop                   | Description                                                                   | Type      |
| ---------------------- | ----------------------------------------------------------------------------- | --------- |
| `newPassword`          | The new password to set                                                       | `string`  |
| `currentPassword`      | The current user password                                                     | `string`  |
| `revokeOtherSessions?` | When set to true, all other active sessions for this user will be invalidated | `boolean` |

POST

/change-password

```
const data = await auth.api.changePassword({
    body: {
        newPassword: "newpassword1234", // required
        currentPassword: "oldpassword1234", // required
        revokeOtherSessions: true,
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop                   | Description                                                                   | Type      |
| ---------------------- | ----------------------------------------------------------------------------- | --------- |
| `newPassword`          | The new password to set                                                       | `string`  |
| `currentPassword`      | The current user password                                                     | `string`  |
| `revokeOtherSessions?` | When set to true, all other active sessions for this user will be invalidated | `boolean` |

### [Set Password](https://www.better-auth.com/docs/concepts/users-accounts#set-password)

If a user was registered using OAuth or other providers, they won't have a password or a credential account. In this case, you can use the `setPassword` action to set a password for the user. For security reasons, this function can only be called from the server. We recommend having users go through a 'forgot password' flow to set a password for their account.

```
await auth.api.setPassword({
    body: { newPassword: "password" },
    headers: // headers containing the user's session token
});
```

## [Delete User](https://www.better-auth.com/docs/concepts/users-accounts#delete-user)

Better Auth provides a utility to hard delete a user from your database. It's disabled by default, but you can enable it easily by passing `enabled:true`

```
export const auth = betterAuth({
    //...other config
    user: {
        deleteUser: {
            enabled: true
        }
    }
})
```

Once enabled, you can call `authClient.deleteUser` to permanently delete user data from your database.

### [Adding Verification Before Deletion](https://www.better-auth.com/docs/concepts/users-accounts#adding-verification-before-deletion)

For added security, you’ll likely want to confirm the user’s intent before deleting their account. A common approach is to send a verification email. Better Auth provides a `sendDeleteAccountVerification` utility for this purpose.
This is especially needed if you have OAuth setup and want them to be able to delete their account without forcing them to login again for a fresh session.

Here’s how you can set it up:

```
export const auth = betterAuth({
    user: {
        deleteUser: {
            enabled: true,
            sendDeleteAccountVerification: async (
                {
                    user,   // The user object
                    url, // The auto-generated URL for deletion
                    token  // The verification token  (can be used to generate custom URL)
                },
                request  // The original request object (optional)
            ) => {
                // Your email sending logic here
                // Example: sendEmail(data.user.email, "Verify Deletion", data.url);
            },
        },
    },
});
```

**How callback verification works:**

- **Callback URL**: The URL provided in `sendDeleteAccountVerification` is a pre-generated link that deletes the user data when accessed.

delete-user.ts

```
await authClient.deleteUser({
    callbackURL: "/goodbye" // you can provide a callback URL to redirect after deletion
});
```

- **Authentication Check**: The user must be signed in to the account they’re attempting to delete.
  If they aren’t signed in, the deletion process will fail.

If you have sent a custom URL, you can use the `deleteUser` method with the token to delete the user.

delete-user.ts

```
await authClient.deleteUser({
    token
});
```

### [Authentication Requirements](https://www.better-auth.com/docs/concepts/users-accounts#authentication-requirements)

To delete a user, the user must meet one of the following requirements:

1. A valid password

if the user has a password, they can delete their account by providing the password.

delete-user.ts

```
await authClient.deleteUser({
    password: "password"
});
```

2. Fresh session

The user must have a `fresh` session token, meaning the user must have signed in recently. This is checked if the password is not provided.

By default `session.freshAge` is set to `60 * 60 * 24` (1 day). You can change this value by passing the `session` object to the `auth` configuration. If it is set to `0`, the freshness check is disabled. It is recommended not to disable this check if you are not using email verification for deleting the account.

delete-user.ts

```
await authClient.deleteUser();
```

3. Enabled email verification (needed for OAuth users)

As OAuth users don't have a password, we need to send a verification email to confirm the user's intent to delete their account. If you have already added the `sendDeleteAccountVerification` callback, you can just call the `deleteUser` method without providing any other information.

delete-user.ts

```
await authClient.deleteUser();
```

4. If you have a custom delete account page and sent that url via the `sendDeleteAccountVerification` callback.
   Then you need to call the `deleteUser` method with the token to complete the deletion.

delete-user.ts

```
await authClient.deleteUser({
    token
});
```

### [Callbacks](https://www.better-auth.com/docs/concepts/users-accounts#callbacks)

**beforeDelete**: This callback is called before the user is deleted. You can use this callback to perform any cleanup or additional checks before deleting the user.

auth.ts

```
export const auth = betterAuth({
    user: {
        deleteUser: {
            enabled: true,
            beforeDelete: async (user) => {
                // Perform any cleanup or additional checks here
            },
        },
    },
});
```

you can also throw `APIError` to interrupt the deletion process.

auth.ts

```
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";

export const auth = betterAuth({
    user: {
        deleteUser: {
            enabled: true,
            beforeDelete: async (user, request) => {
                if (user.email.includes("admin")) {
                    throw new APIError("BAD_REQUEST", {
                        message: "Admin accounts can't be deleted",
                    });
                }
            },
        },
    },
});
```

**afterDelete**: This callback is called after the user is deleted. You can use this callback to perform any cleanup or additional actions after the user is deleted.

auth.ts

```
export const auth = betterAuth({
    user: {
        deleteUser: {
            enabled: true,
            afterDelete: async (user, request) => {
                // Perform any cleanup or additional actions here
            },
        },
    },
});
```

## [Accounts](https://www.better-auth.com/docs/concepts/users-accounts#accounts)

Better Auth supports multiple authentication methods. Each authentication method is called a provider. For example, email and password authentication is a provider, Google authentication is a provider, etc.

When a user signs in using a provider, an account is created for the user. The account stores the authentication data returned by the provider. This data includes the access token, refresh token, and other information returned by the provider.

The account table stores the authentication data of the user [Click here to view the schema](https://www.better-auth.com/docs/concepts/database#account)

### [List User Accounts](https://www.better-auth.com/docs/concepts/users-accounts#list-user-accounts)

To list user accounts you can use `client.user.listAccounts` method. Which will return all accounts associated with a user.

```
const accounts = await authClient.listAccounts();
```

### [Token Encryption](https://www.better-auth.com/docs/concepts/users-accounts#token-encryption)

Better Auth doesn’t encrypt tokens by default and that’s intentional. We want you to have full control over how encryption and decryption are handled, rather than baking in behavior that could be confusing or limiting. If you need to store encrypted tokens (like accessToken or refreshToken), you can use databaseHooks to encrypt them before they’re saved to your database.

```
export const auth = betterAuth({
    databaseHooks: {
        account: {
            create: {
                before(account, context) {
                    const withEncryptedTokens = { ...account };
                    if (account.accessToken) {
                        const encryptedAccessToken = encrypt(account.accessToken)
                        withEncryptedTokens.accessToken = encryptedAccessToken;
                    }
                    if (account.refreshToken) {
                        const encryptedRefreshToken = encrypt(account.refreshToken);
                        withEncryptedTokens.refreshToken = encryptedRefreshToken;
                    }
                    return {
                        data: withEncryptedTokens
                    }
                },
            }
        }
    }
})
```

Then whenever you retrieve back the account make sure to decrypt the tokens before using them.

### [Account Linking](https://www.better-auth.com/docs/concepts/users-accounts#account-linking)

Account linking enables users to associate multiple authentication methods with a single account. With Better Auth, users can connect additional social sign-ons or OAuth providers to their existing accounts if the provider confirms the user's email as verified.

If account linking is disabled, no accounts can be linked, regardless of the provider or email verification status.

auth.ts

```
export const auth = betterAuth({
    account: {
        accountLinking: {
            enabled: true,
        }
    },
});
```

#### [Forced Linking](https://www.better-auth.com/docs/concepts/users-accounts#forced-linking)

You can specify a list of "trusted providers." When a user logs in using a trusted provider, their account will be automatically linked even if the provider doesn’t confirm the email verification status. Use this with caution as it may increase the risk of account takeover.

auth.ts

```
export const auth = betterAuth({
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "github"]
        }
    },
});
```

#### [Manually Linking Accounts](https://www.better-auth.com/docs/concepts/users-accounts#manually-linking-accounts)

Users already signed in can manually link their account to additional social providers or credential-based accounts.

- **Linking Social Accounts:** Use the `linkSocial` method on the client to link a social provider to the user's account.

```
await authClient.linkSocial({
      provider: "google", // Provider to link
      callbackURL: "/callback" // Callback URL after linking completes
});
```

You can also request specific scopes when linking a social account, which can be different from the scopes used during the initial authentication:

```
await authClient.linkSocial({
      provider: "google",
      callbackURL: "/callback",
      scopes: ["https://www.googleapis.com/auth/drive.readonly"] // Request additional scopes
});
```

You can also link accounts using ID tokens directly, without redirecting to the provider's OAuth flow:

```
await authClient.linkSocial({
      provider: "google",
      idToken: {
          token: "id_token_from_provider",
          nonce: "nonce_used_for_token", // Optional
          accessToken: "access_token", // Optional, may be required by some providers
          refreshToken: "refresh_token" // Optional
      }
});
```

This is useful when you already have valid tokens from the provider, for example:

- After signing in with a native SDK
- When using a mobile app that handles authentication
- When implementing custom OAuth flows

The ID token must be valid and the provider must support ID token verification.

If you want your users to be able to link a social account with a different email address than the user, or if you want to use a provider that does not return email addresses, you will need to enable this in the account linking settings.

auth.ts

```
export const auth = betterAuth({
    account: {
        accountLinking: {
            allowDifferentEmails: true
        }
    },
});
```

If you want the newly linked accounts to update the user information, you need to enable this in the account linking settings.

auth.ts

```
export const auth = betterAuth({
    account: {
        accountLinking: {
            updateUserInfoOnLink: true
        }
    },
});
```

- **Linking Credential-Based Accounts:** To link a credential-based account (e.g., email and password), users can initiate a "forgot password" flow, or you can call the `setPassword` method on the server.

```
await auth.api.setPassword({
      headers: /* headers containing the user's session token */,
      password: /* new password */
});
```

`setPassword` can't be called from the client for security reasons.

### [Account Unlinking](https://www.better-auth.com/docs/concepts/users-accounts#account-unlinking)

You can unlink a user account by providing a `providerId`.

```
await authClient.unlinkAccount({
    providerId: "google"
});

// Unlink a specific account
await authClient.unlinkAccount({
    providerId: "google",
    accountId: "123"
});
```

If the account doesn't exist, it will throw an error. Additionally, if the user only has one account, unlinking will be prevented to stop account lockout (unless `allowUnlinkingAll` is set to `true`).

auth.ts

```
export const auth = betterAuth({
    account: {
        accountLinking: {
            allowUnlinkingAll: true
        }
    },
});
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/users-accounts.mdx)

[Previous Page\\
\\
TypeScript](https://www.better-auth.com/docs/concepts/typescript) [Next Page\\
\\
Email & Password](https://www.better-auth.com/docs/authentication/email-password)

### On this page

[Update User](https://www.better-auth.com/docs/concepts/users-accounts#update-user) [Update User Information](https://www.better-auth.com/docs/concepts/users-accounts#update-user-information) [Change Email](https://www.better-auth.com/docs/concepts/users-accounts#change-email) [Change Password](https://www.better-auth.com/docs/concepts/users-accounts#change-password) [Set Password](https://www.better-auth.com/docs/concepts/users-accounts#set-password) [Delete User](https://www.better-auth.com/docs/concepts/users-accounts#delete-user) [Adding Verification Before Deletion](https://www.better-auth.com/docs/concepts/users-accounts#adding-verification-before-deletion) [Authentication Requirements](https://www.better-auth.com/docs/concepts/users-accounts#authentication-requirements) [Callbacks](https://www.better-auth.com/docs/concepts/users-accounts#callbacks) [Accounts](https://www.better-auth.com/docs/concepts/users-accounts#accounts) [List User Accounts](https://www.better-auth.com/docs/concepts/users-accounts#list-user-accounts) [Token Encryption](https://www.better-auth.com/docs/concepts/users-accounts#token-encryption) [Account Linking](https://www.better-auth.com/docs/concepts/users-accounts#account-linking) [Forced Linking](https://www.better-auth.com/docs/concepts/users-accounts#forced-linking) [Manually Linking Accounts](https://www.better-auth.com/docs/concepts/users-accounts#manually-linking-accounts) [Account Unlinking](https://www.better-auth.com/docs/concepts/users-accounts#account-unlinking)
