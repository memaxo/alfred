---
title: Security | Better Auth
url:
description: Better Auth security features.
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

# Security

Copy MarkdownOpen in

This page contains information about security features of Better Auth.

## [Password Hashing](https://www.better-auth.com/docs/reference/security#password-hashing)

Better Auth uses the `scrypt` algorithm to hash passwords by default. This algorithm is designed to be memory-hard and CPU-intensive, making it resistant to brute-force attacks. You can customize the password hashing function by setting the `password` option in the configuration. This option should include a `hash` function to hash passwords and a `verify` function to verify them.

## [Session Management](https://www.better-auth.com/docs/reference/security#session-management)

### [Session Expiration](https://www.better-auth.com/docs/reference/security#session-expiration)

Better Auth uses secure session management to protect user data. Sessions are stored in the database or a secondary storage, if configured, to prevent unauthorized access. By default, sessions expire after 7 days, but you can customize this value in the configuration. Additionally, each time a session is used, if it reaches the `updateAge` threshold, the expiration date is extended, which by default is set to 1 day.

### [Session Revocation](https://www.better-auth.com/docs/reference/security#session-revocation)

Better Auth allows you to revoke sessions to enhance security. When a session is revoked, the user is logged out and can no longer access the application. A logged in user can also revoke their own sessions to log out from different devices or browsers.

See the [session management](https://www.better-auth.com/docs/concepts/session-management) for more details.

## [CSRF Protection](https://www.better-auth.com/docs/reference/security#csrf-protection)

Better Auth ensures CSRF protection by validating the Origin header in requests. This check confirms that requests originate from the application or a trusted source. If a request comes from an untrusted origin, it is blocked to prevent potential CSRF attacks. By default, the origin matching the base URL is trusted, but you can set a list of trusted origins in the trustedOrigins configuration option.

## [OAuth State and PKCE](https://www.better-auth.com/docs/reference/security#oauth-state-and-pkce)

To secure OAuth flows, Better Auth stores the OAuth state and PKCE (Proof Key for Code Exchange) in the database. The state helps prevent CSRF attacks, while PKCE protects against code injection threats. Once the OAuth process completes, these values are removed from the database.

## [Cookies](https://www.better-auth.com/docs/reference/security#cookies)

Better Auth assigns secure cookies by default when the base URL uses `https`. These secure cookies are encrypted and only sent over secure connections, adding an extra layer of protection. They are also set with the `sameSite` attribute to `lax` by default to prevent cross-site request forgery attacks. And the `httpOnly` attribute is enabled to prevent client-side JavaScript from accessing the cookie.

For Cross-Subdomain Cookies, you can set the `crossSubDomainCookies` option in the configuration. This option allows cookies to be shared across subdomains, enabling seamless authentication across multiple subdomains.

### [Customizing Cookies](https://www.better-auth.com/docs/reference/security#customizing-cookies)

You can customize cookie names to minimize the risk of fingerprinting attacks and set specific cookie options as needed for additional control. For more information, refer to the [cookie options](https://www.better-auth.com/docs/concepts/cookies).

Plugins can also set custom cookie options to align with specific security needs. If you're using Better Auth in non-browser environments, plugins offer ways to manage cookies securely in those contexts as well.

## [Rate Limiting](https://www.better-auth.com/docs/reference/security#rate-limiting)

Better Auth includes built-in rate limiting to safeguard against brute-force attacks. Rate limits are applied across all routes by default, with specific routes subject to stricter limits based on potential risk.

## [IP Address Headers](https://www.better-auth.com/docs/reference/security#ip-address-headers)

Better Auth uses client IP addresses for rate limiting and security monitoring. By default, it reads the IP address from the standard `X-Forwarded-For` header. However, you can configure a specific trusted header to ensure accurate IP address detection and prevent IP spoofing attacks.

You can configure the IP address header in your Better Auth configuration:

```
{
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip'] // or any other custom header
    }
  }
}
```

This ensures that Better Auth only accepts IP addresses from your trusted proxy's header, making it more difficult for attackers to bypass rate limiting or other IP-based security measures by spoofing headers.

> **Important**: When setting a custom IP address header, ensure that your proxy or load balancer is properly configured to set this header, and that it cannot be set by end users directly.

## [Trusted Origins](https://www.better-auth.com/docs/reference/security#trusted-origins)

Trusted origins prevent CSRF attacks and block open redirects. You can set a list of trusted origins in the `trustedOrigins` configuration option. Requests from origins not on this list are automatically blocked.

### [Basic Usage](https://www.better-auth.com/docs/reference/security#basic-usage)

The most basic usage is to specify exact origins:

```
{
  trustedOrigins: [\
    "https://example.com",\
    "https://app.example.com",\
    "http://localhost:3000"\
  ]
}
```

### [Wildcard Domains](https://www.better-auth.com/docs/reference/security#wildcard-domains)

Better Auth supports wildcard patterns in trusted origins, which allows you to trust multiple subdomains with a single entry:

```
{
  trustedOrigins: [\
    "*.example.com",             // Trust all subdomains of example.com (any protocol)\
    "https://*.example.com",     // Trust only HTTPS subdomains of example.com\
    "http://*.dev.example.com"   // Trust all HTTP subdomains of dev.example.com\
  ]
}
```

#### [Protocol-specific wildcards](https://www.better-auth.com/docs/reference/security#protocol-specific-wildcards)

When using a wildcard pattern with a protocol prefix (like `https://`):

- The protocol must match exactly
- The domain can have any subdomain in place of the `*`
- Requests using a different protocol will be rejected, even if the domain matches

#### [Protocol-agnostic wildcards](https://www.better-auth.com/docs/reference/security#protocol-agnostic-wildcards)

When using a wildcard pattern without a protocol prefix (like `*.example.com`):

- Any protocol (http, https, etc.) will be accepted
- The domain must match the wildcard pattern

### [Custom Schemes](https://www.better-auth.com/docs/reference/security#custom-schemes)

Trusted origins also support custom schemes for mobile apps and browser extensions:

```
{
  trustedOrigins: [\
    "myapp://",                               // Mobile app scheme\
    "chrome-extension://YOUR_EXTENSION_ID"    // Browser extension\
  ]
}
```

## [Reporting Vulnerabilities](https://www.better-auth.com/docs/reference/security#reporting-vulnerabilities)

If you discover a security vulnerability in Better Auth, please report it to us at [security@better-auth.com](mailto:security@better-auth.com). We address all reports promptly, and credits will be given for validated discoveries.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/reference/security.mdx)

[Previous Page\\
\\
Resources](https://www.better-auth.com/docs/reference/resources) [Next Page\\
\\
Telemetry](https://www.better-auth.com/docs/reference/telemetry)

### On this page

[Password Hashing](https://www.better-auth.com/docs/reference/security#password-hashing) [Session Management](https://www.better-auth.com/docs/reference/security#session-management) [Session Expiration](https://www.better-auth.com/docs/reference/security#session-expiration) [Session Revocation](https://www.better-auth.com/docs/reference/security#session-revocation) [CSRF Protection](https://www.better-auth.com/docs/reference/security#csrf-protection) [OAuth State and PKCE](https://www.better-auth.com/docs/reference/security#oauth-state-and-pkce) [Cookies](https://www.better-auth.com/docs/reference/security#cookies) [Customizing Cookies](https://www.better-auth.com/docs/reference/security#customizing-cookies) [Rate Limiting](https://www.better-auth.com/docs/reference/security#rate-limiting) [IP Address Headers](https://www.better-auth.com/docs/reference/security#ip-address-headers) [Trusted Origins](https://www.better-auth.com/docs/reference/security#trusted-origins) [Basic Usage](https://www.better-auth.com/docs/reference/security#basic-usage) [Wildcard Domains](https://www.better-auth.com/docs/reference/security#wildcard-domains) [Protocol-specific wildcards](https://www.better-auth.com/docs/reference/security#protocol-specific-wildcards) [Protocol-agnostic wildcards](https://www.better-auth.com/docs/reference/security#protocol-agnostic-wildcards) [Custom Schemes](https://www.better-auth.com/docs/reference/security#custom-schemes) [Reporting Vulnerabilities](https://www.better-auth.com/docs/reference/security#reporting-vulnerabilities)
