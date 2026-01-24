---
title: Access Control Setup - Laminar documentation
url:
description: GitHub based access control for restricted users
language: en
---

[Skip to main content](https://docs.lmnr.ai/self-hosting/access-control-setup#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Self-hosting

Access Control Setup

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/self-hosting/access-control-setup#overview)
- [GitHub Authentication Setup](https://docs.lmnr.ai/self-hosting/access-control-setup#github-authentication-setup)
- [Access Control](https://docs.lmnr.ai/self-hosting/access-control-setup#access-control)
- [Default Behavior](https://docs.lmnr.ai/self-hosting/access-control-setup#default-behavior)
- [Restricted Access](https://docs.lmnr.ai/self-hosting/access-control-setup#restricted-access)

## [​](https://docs.lmnr.ai/self-hosting/access-control-setup#overview) Overview

Laminar supports optional GitHub authentication for controlling access to your self-hosted instance.

## [​](https://docs.lmnr.ai/self-hosting/access-control-setup#github-authentication-setup) GitHub Authentication Setup

To enable GitHub authentication, configure these environment variables in your frontend:

Copy

```
AUTH_GITHUB_ID=your_github_oauth_app_id
AUTH_GITHUB_SECRET=your_github_oauth_app_secret

```

## [​](https://docs.lmnr.ai/self-hosting/access-control-setup#access-control) Access Control

### [​](https://docs.lmnr.ai/self-hosting/access-control-setup#default-behavior) Default Behavior

By default (without an `allowed-emails.json` file), any GitHub user can access your platform after authentication.

### [​](https://docs.lmnr.ai/self-hosting/access-control-setup#restricted-access) Restricted Access

To limit access to specific users, create an `allowed-emails.json` file in your project root:

Copy

```
{
  "emails ": [\
    "user1@example.com",\
    "user2@example.com"\
  ]
}

```

[Self-hosting](https://docs.lmnr.ai/self-hosting/setup) [Cursor Rules](https://docs.lmnr.ai/cursor)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
