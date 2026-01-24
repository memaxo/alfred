---
title: Captcha | Better Auth
url:
description: Captcha plugin
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

# Captcha

Copy MarkdownOpen in

The **Captcha Plugin** integrates bot protection into your Better Auth system by adding captcha verification for key endpoints. This plugin ensures that only human users can perform actions like signing up, signing in, or resetting passwords. The following providers are currently supported:

- [Google reCAPTCHA](https://developers.google.com/recaptcha)
- [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/)
- [hCaptcha](https://www.hcaptcha.com/)

This plugin works out of the box with [Email & Password](https://www.better-auth.com/docs/authentication/email-password) authentication. To use it with other authentication methods, you will need to configure the [endpoints](https://www.better-auth.com/docs/plugins/captcha#plugin-options) array in the plugin options.

## [Installation](https://www.better-auth.com/docs/plugins/captcha#installation)

### [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/captcha#add-the-plugin-to-your-auth-config)

auth.ts

```
import { betterAuth } from "better-auth";
import { captcha } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [\
        captcha({\
            provider: "cloudflare-turnstile", // or google-recaptcha, hcaptcha\
            secretKey: process.env.TURNSTILE_SECRET_KEY!,\
        }),\
    ],
});
```

### [Add the captcha token to your request headers](https://www.better-auth.com/docs/plugins/captcha#add-the-captcha-token-to-your-request-headers)

Add the captcha token to your request headers for all protected endpoints. This example shows how to include it in a `signIn` request:

```
await authClient.signIn.email({
    email: "user@example.com",
    password: "secure-password",
    fetchOptions: {
        headers: {
            "x-captcha-response": turnstileToken,
            "x-captcha-user-remote-ip": userIp, // optional: forwards the user's IP address to the captcha service
        },
    },
});
```

- To implement Cloudflare Turnstile on the client side, follow the official [Cloudflare Turnstile documentation](https://developers.cloudflare.com/turnstile/) or use a library like [react-turnstile](https://www.npmjs.com/package/@marsidev/react-turnstile).
- To implement Google reCAPTCHA on the client side, follow the official [Google reCAPTCHA documentation](https://developers.google.com/recaptcha/intro) or use libraries like [react-google-recaptcha](https://www.npmjs.com/package/react-google-recaptcha) (v2) and [react-google-recaptcha-v3](https://www.npmjs.com/package/react-google-recaptcha-v3) (v3).
- To implement hCaptcha on the client side, follow the official [hCaptcha documentation](https://docs.hcaptcha.com/#add-the-hcaptcha-widget-to-your-webpage) or use libraries like [@hcaptcha/react-hcaptcha](https://www.npmjs.com/package/@hcaptcha/react-hcaptcha)

## [How it works](https://www.better-auth.com/docs/plugins/captcha#how-it-works)

The plugin acts as a middleware: it intercepts all `POST` requests to configured endpoints (see `endpoints`
in the [Plugin Options](https://www.better-auth.com/docs/plugins/captcha#plugin-options) section).

it validates the captcha token on the server, by calling the captcha provider's `/siteverify`.

- if the token is missing, gets rejected by the captcha provider, or if the `/siteverify` endpoint is
  unavailable, the plugin returns an error and interrupts the request.
- if the token is accepted by the captcha provider, the middleware returns `undefined`, meaning the request is allowed to proceed.

## [Plugin Options](https://www.better-auth.com/docs/plugins/captcha#plugin-options)

- **`provider` (required)**: your captcha provider.
- **`secretKey` (required)**: your provider's secret key used for the server-side validation.
- `endpoints` (optional): overrides the default array of paths where captcha validation is enforced. Default is: `["/sign-up/email", "/sign-in/email", "/forget-password",]`.
- `minScore` (optional - only _Google ReCAPTCHA v3_): minimum score threshold. Default is `0.5`.
- `siteKey` (optional - only _hCaptcha_): prevents tokens issued on one sitekey from being redeemed elsewhere.
- `siteVerifyURLOverride` (optional): overrides endpoint URL for the captcha verification request.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/captcha.mdx)

[Previous Page\\
\\
Device Authorization](https://www.better-auth.com/docs/plugins/device-authorization) [Next Page\\
\\
Have I Been Pwned](https://www.better-auth.com/docs/plugins/have-i-been-pwned)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/captcha#installation) [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/captcha#add-the-plugin-to-your-auth-config) [Add the captcha token to your request headers](https://www.better-auth.com/docs/plugins/captcha#add-the-captcha-token-to-your-request-headers) [How it works](https://www.better-auth.com/docs/plugins/captcha#how-it-works) [Plugin Options](https://www.better-auth.com/docs/plugins/captcha#plugin-options)
