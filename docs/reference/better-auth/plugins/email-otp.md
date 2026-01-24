---
title: Email OTP | Better Auth
url:
description: Email OTP plugin for Better Auth.
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

# Email OTP

Copy MarkdownOpen in

The Email OTP plugin allows user to sign in, verify their email, or reset their password using a one-time password (OTP) sent to their email address.

## [Installation](https://www.better-auth.com/docs/plugins/email-otp#installation)

### [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/email-otp#add-the-plugin-to-your-auth-config)

Add the `emailOTP` plugin to your auth config and implement the `sendVerificationOTP()` method.

auth.ts

```
import { betterAuth } from "better-auth"
import { emailOTP } from "better-auth/plugins"

export const auth = betterAuth({
    // ... other config options
    plugins: [\
        emailOTP({\
            async sendVerificationOTP({ email, otp, type }) {\
                if (type === "sign-in") {\
                    // Send the OTP for sign in\
                } else if (type === "email-verification") {\
                    // Send the OTP for email verification\
                } else {\
                    // Send the OTP for password reset\
                }\
            },\
        })\
    ]
})
```

### [Add the client plugin](https://www.better-auth.com/docs/plugins/email-otp#add-the-client-plugin)

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { emailOTPClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        emailOTPClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/email-otp#usage)

### [Send an OTP](https://www.better-auth.com/docs/plugins/email-otp#send-an-otp)

Use the `sendVerificationOtp()` method to send an OTP to the user's email address.

ClientServer

POST

/email-otp/send-verification-otp

```
const { data, error } = await authClient.emailOtp.sendVerificationOtp({
    email: "user@example.com", // required
    type: "sign-in", // required
});
```

| Prop    | Description                                                             | Type                  |
| ------- | ----------------------------------------------------------------------- | --------------------- | --------- | ------------------ |
| `email` | Email address to send the OTP.                                          | `string`              |
| `type`  | Type of the OTP. `sign-in`, `email-verification`, or `forget-password`. | `"email-verification" | "sign-in" | "forget-password"` |

POST

/email-otp/send-verification-otp

```
const data = await auth.api.sendVerificationOTP({
    body: {
        email: "user@example.com", // required
        type: "sign-in", // required
    },
});
```

| Prop    | Description                                                             | Type                  |
| ------- | ----------------------------------------------------------------------- | --------------------- | --------- | ------------------ |
| `email` | Email address to send the OTP.                                          | `string`              |
| `type`  | Type of the OTP. `sign-in`, `email-verification`, or `forget-password`. | `"email-verification" | "sign-in" | "forget-password"` |

### [Check an OTP (optional)](https://www.better-auth.com/docs/plugins/email-otp#check-an-otp-optional)

Use the `checkVerificationOtp()` method to check if an OTP is valid.

ClientServer

POST

/email-otp/check-verification-otp

```
const { data, error } = await authClient.emailOtp.checkVerificationOtp({
    email: "user@example.com", // required
    type: "sign-in", // required
    otp: "123456", // required
});
```

| Prop    | Description                                                             | Type                  |
| ------- | ----------------------------------------------------------------------- | --------------------- | --------- | ------------------ |
| `email` | Email address to send the OTP.                                          | `string`              |
| `type`  | Type of the OTP. `sign-in`, `email-verification`, or `forget-password`. | `"email-verification" | "sign-in" | "forget-password"` |
| `otp`   | OTP sent to the email.                                                  | `string`              |

POST

/email-otp/check-verification-otp

```
const data = await auth.api.checkVerificationOTP({
    body: {
        email: "user@example.com", // required
        type: "sign-in", // required
        otp: "123456", // required
    },
});
```

| Prop    | Description                                                             | Type                  |
| ------- | ----------------------------------------------------------------------- | --------------------- | --------- | ------------------ |
| `email` | Email address to send the OTP.                                          | `string`              |
| `type`  | Type of the OTP. `sign-in`, `email-verification`, or `forget-password`. | `"email-verification" | "sign-in" | "forget-password"` |
| `otp`   | OTP sent to the email.                                                  | `string`              |

### [Sign In with OTP](https://www.better-auth.com/docs/plugins/email-otp#sign-in-with-otp)

To sign in with OTP, use the `sendVerificationOtp()` method to send a "sign-in" OTP to the user's email address.

ClientServer

POST

/email-otp/send-verification-otp

```
const { data, error } = await authClient.emailOtp.sendVerificationOtp({
    email: "user@example.com", // required
    type: "sign-in", // required
});
```

| Prop    | Description                    | Type        |
| ------- | ------------------------------ | ----------- |
| `email` | Email address to send the OTP. | `string`    |
| `type`  | Type of the OTP.               | `"sign-in"` |

POST

/email-otp/send-verification-otp

```
const data = await auth.api.sendVerificationOTP({
    body: {
        email: "user@example.com", // required
        type: "sign-in", // required
    },
});
```

| Prop    | Description                    | Type        |
| ------- | ------------------------------ | ----------- |
| `email` | Email address to send the OTP. | `string`    |
| `type`  | Type of the OTP.               | `"sign-in"` |

Once the user provides the OTP, you can sign in the user using the `signIn.emailOtp()` method.

ClientServer

POST

/sign-in/email-otp

```
const { data, error } = await authClient.signIn.emailOtp({
    email: "user@example.com", // required
    otp: "123456", // required
});
```

| Prop    | Description               | Type     |
| ------- | ------------------------- | -------- |
| `email` | Email address to sign in. | `string` |
| `otp`   | OTP sent to the email.    | `string` |

POST

/sign-in/email-otp

```
const data = await auth.api.signInEmailOTP({
    body: {
        email: "user@example.com", // required
        otp: "123456", // required
    },
});
```

| Prop    | Description               | Type     |
| ------- | ------------------------- | -------- |
| `email` | Email address to sign in. | `string` |
| `otp`   | OTP sent to the email.    | `string` |

If the user is not registered, they'll be automatically registered. If you want to prevent this, you can pass `disableSignUp` as `true` in the [options](https://www.better-auth.com/docs/plugins/email-otp#options).

### [Verify Email with OTP](https://www.better-auth.com/docs/plugins/email-otp#verify-email-with-otp)

To verify the user's email address with OTP, use the `sendVerificationOtp()` method to send an "email-verification" OTP to the user's email address.

ClientServer

POST

/email-otp/send-verification-otp

```
const { data, error } = await authClient.emailOtp.sendVerificationOtp({
    email: "user@example.com", // required
    type: "email-verification", // required
});
```

| Prop    | Description                    | Type                   |
| ------- | ------------------------------ | ---------------------- |
| `email` | Email address to send the OTP. | `string`               |
| `type`  | Type of the OTP.               | `"email-verification"` |

POST

/email-otp/send-verification-otp

```
const data = await auth.api.sendVerificationOTP({
    body: {
        email: "user@example.com", // required
        type: "email-verification", // required
    },
});
```

| Prop    | Description                    | Type                   |
| ------- | ------------------------------ | ---------------------- |
| `email` | Email address to send the OTP. | `string`               |
| `type`  | Type of the OTP.               | `"email-verification"` |

Once the user provides the OTP, use the `verifyEmail()` method to complete email verification.

ClientServer

POST

/email-otp/verify-email

```
const { data, error } = await authClient.emailOtp.verifyEmail({
    email: "user@example.com", // required
    otp: "123456", // required
});
```

| Prop    | Description              | Type     |
| ------- | ------------------------ | -------- |
| `email` | Email address to verify. | `string` |
| `otp`   | OTP to verify.           | `string` |

POST

/email-otp/verify-email

```
const data = await auth.api.verifyEmailOTP({
    body: {
        email: "user@example.com", // required
        otp: "123456", // required
    },
});
```

| Prop    | Description              | Type     |
| ------- | ------------------------ | -------- |
| `email` | Email address to verify. | `string` |
| `otp`   | OTP to verify.           | `string` |

### [Reset Password with OTP](https://www.better-auth.com/docs/plugins/email-otp#reset-password-with-otp)

To reset the user's password with OTP, use the `forgetPassword.emailOTP()` method to send a "forget-password" OTP to the user's email address.

ClientServer

POST

/forget-password/email-otp

```
const { data, error } = await authClient.forgetPassword.emailOtp({
    email: "user@example.com", // required
});
```

| Prop    | Description                    | Type     |
| ------- | ------------------------------ | -------- |
| `email` | Email address to send the OTP. | `string` |

POST

/forget-password/email-otp

```
const data = await auth.api.forgetPasswordEmailOTP({
    body: {
        email: "user@example.com", // required
    },
});
```

| Prop    | Description                    | Type     |
| ------- | ------------------------------ | -------- |
| `email` | Email address to send the OTP. | `string` |

Once the user provides the OTP, use the `checkVerificationOtp()` method to check if it's valid (optional).

ClientServer

POST

/email-otp/check-verification-otp

```
const { data, error } = await authClient.emailOtp.checkVerificationOtp({
    email: "user@example.com", // required
    type: "forget-password", // required
    otp: "123456", // required
});
```

| Prop    | Description                    | Type                |
| ------- | ------------------------------ | ------------------- |
| `email` | Email address to send the OTP. | `string`            |
| `type`  | Type of the OTP.               | `"forget-password"` |
| `otp`   | OTP sent to the email.         | `string`            |

POST

/email-otp/check-verification-otp

```
const data = await auth.api.checkVerificationOTP({
    body: {
        email: "user@example.com", // required
        type: "forget-password", // required
        otp: "123456", // required
    },
});
```

| Prop    | Description                    | Type                |
| ------- | ------------------------------ | ------------------- |
| `email` | Email address to send the OTP. | `string`            |
| `type`  | Type of the OTP.               | `"forget-password"` |
| `otp`   | OTP sent to the email.         | `string`            |

Then, use the `resetPassword()` method to reset the user's password.

ClientServer

POST

/email-otp/reset-password

```
const { data, error } = await authClient.emailOtp.resetPassword({
    email: "user@example.com", // required
    otp: "123456", // required
    password: "new-secure-password", // required
});
```

| Prop       | Description                          | Type     |
| ---------- | ------------------------------------ | -------- |
| `email`    | Email address to reset the password. | `string` |
| `otp`      | OTP sent to the email.               | `string` |
| `password` | New password.                        | `string` |

POST

/email-otp/reset-password

```
const data = await auth.api.resetPasswordEmailOTP({
    body: {
        email: "user@example.com", // required
        otp: "123456", // required
        password: "new-secure-password", // required
    },
});
```

| Prop       | Description                          | Type     |
| ---------- | ------------------------------------ | -------- |
| `email`    | Email address to reset the password. | `string` |
| `otp`      | OTP sent to the email.               | `string` |
| `password` | New password.                        | `string` |

### [Override Default Email Verification](https://www.better-auth.com/docs/plugins/email-otp#override-default-email-verification)

To override the default email verification, pass `overrideDefaultEmailVerification: true` in the options. This will make the system use an email OTP instead of the default verification link whenever email verification is triggered. In other words, the user will verify their email using an OTP rather than clicking a link.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  plugins: [\
    emailOTP({\
      overrideDefaultEmailVerification: true,\
      async sendVerificationOTP({ email, otp, type }) {\
        // Implement the sendVerificationOTP method to send the OTP to the user's email address\
      },\
    }),\
  ],
});
```

## [Options](https://www.better-auth.com/docs/plugins/email-otp#options)

- `sendVerificationOTP`: A function that sends the OTP to the user's email address. The function receives an object with the following properties:
  - `email`: The user's email address.
  - `otp`: The OTP to send.
  - `type`: The type of OTP to send. Can be "sign-in", "email-verification", or "forget-password".
- `otpLength`: The length of the OTP. Defaults to `6`.

- `expiresIn`: The expiry time of the OTP in seconds. Defaults to `300` seconds.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    plugins: [\
        emailOTP({\
            otpLength: 8,\
            expiresIn: 600\
        })\
    ]
})
```

- `sendVerificationOnSignUp`: A boolean value that determines whether to send the OTP when a user signs up. Defaults to `false`.

- `disableSignUp`: A boolean value that determines whether to prevent automatic sign-up when the user is not registered. Defaults to `false`.

- `generateOTP`: A function that generates the OTP. Defaults to a random 6-digit number.

- `allowedAttempts`: The maximum number of attempts allowed for verifying an OTP. Defaults to `3`. After exceeding this limit, the OTP becomes invalid and the user needs to request a new one.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    plugins: [\
        emailOTP({\
            allowedAttempts: 5, // Allow 5 attempts before invalidating the OTP\
            expiresIn: 300\
        })\
    ]
})
```

When the maximum attempts are exceeded, the `verifyOTP`, `signIn.emailOtp`, `verifyEmail`, and `resetPassword` methods will return an error with code `TOO_MANY_ATTEMPTS`.

- `storeOTP`: The method to store the OTP in your database, wether `encrypted`, `hashed` or `plain` text. Default is `plain` text.

Note: This will not affect the OTP sent to the user, it will only affect the OTP stored in your database.

Alternatively, you can pass a custom encryptor or hasher to store the OTP in your database.

**Custom encryptor**

auth.ts

```
emailOTP({
    storeOTP: {
        encrypt: async (otp) => {
            return myCustomEncryptor(otp);
        },
        decrypt: async (otp) => {
            return myCustomDecryptor(otp);
        },
    }
})
```

**Custom hasher**

auth.ts

```
emailOTP({
    storeOTP: {
        hash: async (otp) => {
            return myCustomHasher(otp);
        },
    }
})
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/email-otp.mdx)

[Previous Page\\
\\
Magic Link](https://www.better-auth.com/docs/plugins/magic-link) [Next Page\\
\\
Passkey](https://www.better-auth.com/docs/plugins/passkey)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/email-otp#installation) [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/email-otp#add-the-plugin-to-your-auth-config) [Add the client plugin](https://www.better-auth.com/docs/plugins/email-otp#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/email-otp#usage) [Send an OTP](https://www.better-auth.com/docs/plugins/email-otp#send-an-otp) [Check an OTP (optional)](https://www.better-auth.com/docs/plugins/email-otp#check-an-otp-optional) [Sign In with OTP](https://www.better-auth.com/docs/plugins/email-otp#sign-in-with-otp) [Verify Email with OTP](https://www.better-auth.com/docs/plugins/email-otp#verify-email-with-otp) [Reset Password with OTP](https://www.better-auth.com/docs/plugins/email-otp#reset-password-with-otp) [Override Default Email Verification](https://www.better-auth.com/docs/plugins/email-otp#override-default-email-verification) [Options](https://www.better-auth.com/docs/plugins/email-otp#options)
