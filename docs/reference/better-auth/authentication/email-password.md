---
title: Email & Password | Better Auth
url:
description: Implementing email and password authentication with Better Auth.
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

# Email & Password

Copy MarkdownOpen in

Email and password authentication is a common method used by many applications. Better Auth provides a built-in email and password authenticator that you can easily integrate into your project.

If you prefer username-based authentication, check out the [username plugin](https://www.better-auth.com/docs/plugins/username). It extends the
email and password authenticator with username support.

## [Enable Email and Password](https://www.better-auth.com/docs/authentication/email-password#enable-email-and-password)

To enable email and password authentication, you need to set the `emailAndPassword.enabled` option to `true` in the `auth` configuration.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
});
```

If it's not enabled, it'll not allow you to sign in or sign up with email and
password.

## [Usage](https://www.better-auth.com/docs/authentication/email-password#usage)

### [Sign Up](https://www.better-auth.com/docs/authentication/email-password#sign-up)

To sign a user up, you can use the `signUp.email` function provided by the client.

ClientServer

POST

/sign-up/email

```
const { data, error } = await authClient.signUp.email({
    name: "John Doe", // required
    email: "john.doe@example.com", // required
    password: "password1234", // required
    image: "https://example.com/image.png",
    callbackURL: "https://example.com/callback",
});
```

| Prop           | Description                                                                               | Type     |
| -------------- | ----------------------------------------------------------------------------------------- | -------- |
| `name`         | The name of the user.                                                                     | `string` |
| `email`        | The email address of the user.                                                            | `string` |
| `password`     | The password of the user. It should be at least 8 characters long and max 128 by default. | `string` |
| `image?`       | An optional profile image of the user.                                                    | `string` |
| `callbackURL?` | An optional URL to redirect to after the user signs up.                                   | `string` |

POST

/sign-up/email

```
const data = await auth.api.signUpEmail({
    body: {
        name: "John Doe", // required
        email: "john.doe@example.com", // required
        password: "password1234", // required
        image: "https://example.com/image.png",
        callbackURL: "https://example.com/callback",
    },
});
```

| Prop           | Description                                                                               | Type     |
| -------------- | ----------------------------------------------------------------------------------------- | -------- |
| `name`         | The name of the user.                                                                     | `string` |
| `email`        | The email address of the user.                                                            | `string` |
| `password`     | The password of the user. It should be at least 8 characters long and max 128 by default. | `string` |
| `image?`       | An optional profile image of the user.                                                    | `string` |
| `callbackURL?` | An optional URL to redirect to after the user signs up.                                   | `string` |

These are the default properties for the sign up email endpoint, however it's possible that with [additional fields](https://www.better-auth.com/docs/concepts/typescript#additional-fields) or special plugins you can pass more properties to the endpoint.

### [Sign In](https://www.better-auth.com/docs/authentication/email-password#sign-in)

To sign a user in, you can use the `signIn.email` function provided by the client.

ClientServer

POST

/sign-in/email

```
const { data, error } = await authClient.signIn.email({
    email: "john.doe@example.com", // required
    password: "password1234", // required
    rememberMe: true,
    callbackURL: "https://example.com/callback",
});
```

| Prop           | Description                                                                                  | Type      |
| -------------- | -------------------------------------------------------------------------------------------- | --------- |
| `email`        | The email address of the user.                                                               | `string`  |
| `password`     | The password of the user. It should be at least 8 characters long and max 128 by default.    | `string`  |
| `rememberMe?`  | If false, the user will be signed out when the browser is closed. (optional) (default: true) | `boolean` |
| `callbackURL?` | An optional URL to redirect to after the user signs in. (optional)                           | `string`  |

POST

/sign-in/email

```
const data = await auth.api.signInEmail({
    body: {
        email: "john.doe@example.com", // required
        password: "password1234", // required
        rememberMe: true,
        callbackURL: "https://example.com/callback",
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop           | Description                                                                                  | Type      |
| -------------- | -------------------------------------------------------------------------------------------- | --------- |
| `email`        | The email address of the user.                                                               | `string`  |
| `password`     | The password of the user. It should be at least 8 characters long and max 128 by default.    | `string`  |
| `rememberMe?`  | If false, the user will be signed out when the browser is closed. (optional) (default: true) | `boolean` |
| `callbackURL?` | An optional URL to redirect to after the user signs in. (optional)                           | `string`  |

These are the default properties for the sign in email endpoint, however it's possible that with [additional fields](https://www.better-auth.com/docs/concepts/typescript#additional-fields) or special plugins you can pass different properties to the endpoint.

### [Sign Out](https://www.better-auth.com/docs/authentication/email-password#sign-out)

To sign a user out, you can use the `signOut` function provided by the client.

ClientServer

POST

/sign-out

```
await authClient.signOut();
```

POST

/sign-out

```
await auth.api.signOut({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

you can pass `fetchOptions` to redirect onSuccess

auth-client.ts

```
await authClient.signOut({
  fetchOptions: {
    onSuccess: () => {
      router.push("/login"); // redirect to login page
    },
  },
});
```

### [Email Verification](https://www.better-auth.com/docs/authentication/email-password#email-verification)

To enable email verification, you need to pass a function that sends a verification email with a link. The `sendVerificationEmail` function takes a data object with the following properties:

- `user`: The user object.
- `url`: The URL to send to the user which contains the token.
- `token`: A verification token used to complete the email verification.

and a `request` object as the second parameter.

auth.ts

```
import { betterAuth } from "better-auth";
import { sendEmail } from "./email"; // your email sending function

export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ( { user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Click the link to verify your email: ${url}`,
      });
    },
  },
});
```

On the client side you can use `sendVerificationEmail` function to send verification link to user. This will trigger the `sendVerificationEmail` function you provided in the `auth` configuration.

Once the user clicks on the link in the email, if the token is valid, the user will be redirected to the URL provided in the `callbackURL` parameter. If the token is invalid, the user will be redirected to the URL provided in the `callbackURL` parameter with an error message in the query string `?error=invalid_token`.

#### [Require Email Verification](https://www.better-auth.com/docs/authentication/email-password#require-email-verification)

If you enable require email verification, users must verify their email before they can log in. And every time a user tries to sign in, sendVerificationEmail is called.

This only works if you have sendVerificationEmail implemented and if the user
is trying to sign in with email and password.

auth.ts

```
export const auth = betterAuth({
  emailAndPassword: {
    requireEmailVerification: true,
  },
});
```

If a user tries to sign in without verifying their email, you can handle the error and show a message to the user.

auth-client.ts

```
await authClient.signIn.email(
  {
    email: "email@example.com",
    password: "password",
  },
  {
    onError: (ctx) => {
      // Handle the error
      if (ctx.error.status === 403) {
        alert("Please verify your email address");
      }
      //you can also show the original error message
      alert(ctx.error.message);
    },
  }
);
```

#### [Triggering manually Email Verification](https://www.better-auth.com/docs/authentication/email-password#triggering-manually-email-verification)

You can trigger the email verification manually by calling the `sendVerificationEmail` function.

```
await authClient.sendVerificationEmail({
  email: "user@email.com",
  callbackURL: "/", // The redirect URL after verification
});
```

### [Request Password Reset](https://www.better-auth.com/docs/authentication/email-password#request-password-reset)

To allow users to reset a password first you need to provide `sendResetPassword` function to the email and password authenticator. The `sendResetPassword` function takes a data object with the following properties:

- `user`: The user object.
- `url`: The URL to send to the user which contains the token.
- `token`: A verification token used to complete the password reset.

and a `request` object as the second parameter.

auth.ts

```
import { betterAuth } from "better-auth";
import { sendEmail } from "./email"; // your email sending function

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({user, url, token}, request) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Click the link to reset your password: ${url}`,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      // your logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
});
```

Additionally, you can provide an `onPasswordReset` callback to execute logic after a password has been successfully reset.

Once you configured your server you can call `requestPasswordReset` function to send reset password link to user. If the user exists, it will trigger the `sendResetPassword` function you provided in the auth config.

ClientServer

POST

/request-password-reset

```
const { data, error } = await authClient.requestPasswordReset({
    email: "john.doe@example.com", // required
    redirectTo: "https://example.com/reset-password",
});
```

| Prop          | Description                                                                                                                                                                                                                                          | Type     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `email`       | The email address of the user to send a password reset email to                                                                                                                                                                                      | `string` |
| `redirectTo?` | The URL to redirect the user to reset their password. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter \`?token=VALID_TOKEN | `string` |

POST

/request-password-reset

```
const data = await auth.api.requestPasswordReset({
    body: {
        email: "john.doe@example.com", // required
        redirectTo: "https://example.com/reset-password",
    },
});
```

| Prop          | Description                                                                                                                                                                                                                                          | Type     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `email`       | The email address of the user to send a password reset email to                                                                                                                                                                                      | `string` |
| `redirectTo?` | The URL to redirect the user to reset their password. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter \`?token=VALID_TOKEN | `string` |

When a user clicks on the link in the email, they will be redirected to the reset password page. You can add the reset password page to your app. Then you can use `resetPassword` function to reset the password. It takes an object with the following properties:

- `newPassword`: The new password of the user.

auth-client.ts

```
const { data, error } = await authClient.resetPassword({
  newPassword: "password1234",
  token,
});
```

ClientServer

POST

/reset-password

```
const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
  // Handle the error
}

const { data, error } = await authClient.resetPassword({
    newPassword: "password1234", // required
    token, // required
});
```

| Prop          | Description                     | Type     |
| ------------- | ------------------------------- | -------- |
| `newPassword` | The new password to set         | `string` |
| `token`       | The token to reset the password | `string` |

POST

/reset-password

```
const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
  // Handle the error
}

const data = await auth.api.resetPassword({
    body: {
        newPassword: "password1234", // required
        token, // required
    },
});
```

| Prop          | Description                     | Type     |
| ------------- | ------------------------------- | -------- |
| `newPassword` | The new password to set         | `string` |
| `token`       | The token to reset the password | `string` |

### [Update password](https://www.better-auth.com/docs/authentication/email-password#update-password)

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

### [Configuration](https://www.better-auth.com/docs/authentication/email-password#configuration)

**Password**

Better Auth stores passwords inside the `account` table with `providerId` set to `credential`.

**Password Hashing**: Better Auth uses `scrypt` to hash passwords. The `scrypt` algorithm is designed to be slow and memory-intensive to make it difficult for attackers to brute force passwords. OWASP recommends using `scrypt` if `argon2id` is not available. We decided to use `scrypt` because it's natively supported by Node.js.

You can pass custom password hashing algorithm by setting `passwordHasher` option in the `auth` configuration.

auth.ts

```
import { betterAuth } from "better-auth"
import { scrypt } from "scrypt"

export const auth = betterAuth({
    //...rest of the options
    emailAndPassword: {
        password: {
            hash: // your custom password hashing function
            verify: // your custom password verification function
        }
    }
})
```

| Prop                           | Type       | Default |
| ------------------------------ | ---------- | ------- |
| `enabled?`                     | `boolean`  | `false` |
| `disableSignUp?`               | `boolean`  | `false` |
| `minPasswordLength?`           | `number`   | `8`     |
| `maxPasswordLength?`           | `number`   | `128`   |
| `sendResetPassword?`           | `function` | -       |
| `onPasswordReset?`             | `function` | -       |
| `resetPasswordTokenExpiresIn?` | `number`   | `3600`  |
| `password?`                    | `object`   | -       |

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/email-password.mdx)

[Previous Page\\
\\
Users & Accounts](https://www.better-auth.com/docs/concepts/users-accounts) [Next Page\\
\\
Social Sign-On](https://www.better-auth.com/docs/authentication/email-password)

### On this page

[Enable Email and Password](https://www.better-auth.com/docs/authentication/email-password#enable-email-and-password) [Usage](https://www.better-auth.com/docs/authentication/email-password#usage) [Sign Up](https://www.better-auth.com/docs/authentication/email-password#sign-up) [Sign In](https://www.better-auth.com/docs/authentication/email-password#sign-in) [Sign Out](https://www.better-auth.com/docs/authentication/email-password#sign-out) [Email Verification](https://www.better-auth.com/docs/authentication/email-password#email-verification) [Require Email Verification](https://www.better-auth.com/docs/authentication/email-password#require-email-verification) [Triggering manually Email Verification](https://www.better-auth.com/docs/authentication/email-password#triggering-manually-email-verification) [Request Password Reset](https://www.better-auth.com/docs/authentication/email-password#request-password-reset) [Update password](https://www.better-auth.com/docs/authentication/email-password#update-password) [Configuration](https://www.better-auth.com/docs/authentication/email-password#configuration)
