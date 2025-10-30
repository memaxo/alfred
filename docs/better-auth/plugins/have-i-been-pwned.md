---
title: Have I Been Pwned | Better Auth
url: 
description: A plugin to check if a password has been compromised
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

# Have I Been Pwned

Copy MarkdownOpen in

The Have I Been Pwned plugin helps protect user accounts by preventing the use of passwords that have been exposed in known data breaches. It uses the [Have I Been Pwned](https://haveibeenpwned.com/) API to check if a password has been compromised.

## [Installation](https://www.better-auth.com/docs/plugins/have-i-been-pwned\#installation)

### [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/have-i-been-pwned\#add-the-plugin-to-your-auth-config)

auth.ts

```
import { betterAuth } from "better-auth"
import { haveIBeenPwned } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [\
        haveIBeenPwned()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/have-i-been-pwned\#usage)

When a user attempts to create an account or update their password with a compromised password, they'll receive the following default error:

```
{
  "code": "PASSWORD_COMPROMISED",
  "message": "Password is compromised"
}
```

## [Config](https://www.better-auth.com/docs/plugins/have-i-been-pwned\#config)

You can customize the error message:

```
haveIBeenPwned({
    customPasswordCompromisedMessage: "Please choose a more secure password."
})
```

## [Security Notes](https://www.better-auth.com/docs/plugins/have-i-been-pwned\#security-notes)

- Only the first 5 characters of the password hash are sent to the API
- The full password is never transmitted
- Provides an additional layer of account security

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/have-i-been-pwned.mdx)

[Previous Page\\
\\
Captcha](https://www.better-auth.com/docs/plugins/captcha) [Next Page\\
\\
Last Login Method](https://www.better-auth.com/docs/plugins/last-login-method)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/have-i-been-pwned#installation) [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/have-i-been-pwned#add-the-plugin-to-your-auth-config) [Usage](https://www.better-auth.com/docs/plugins/have-i-been-pwned#usage) [Config](https://www.better-auth.com/docs/plugins/have-i-been-pwned#config) [Security Notes](https://www.better-auth.com/docs/plugins/have-i-been-pwned#security-notes)