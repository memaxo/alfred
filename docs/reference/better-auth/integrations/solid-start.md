---
title: SolidStart Integration | Better Auth
url: 
description: Integrate Better Auth with SolidStart.
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

# SolidStart Integration

Copy MarkdownOpen in

Before you start, make sure you have a Better Auth instance configured. If you haven't done that yet, check out the [installation](https://www.better-auth.com/docs/installation).

### [Mount the handler](https://www.better-auth.com/docs/integrations/solid-start\#mount-the-handler)

We need to mount the handler to SolidStart server. Put the following code in your `*auth.ts` file inside `/routes/api/auth` folder.

\*auth.ts

```
import { auth } from "~/lib/auth";
import { toSolidStartHandler } from "better-auth/solid-start";

export const { GET, POST } = toSolidStartHandler(auth);
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/solid-start.mdx)

[Previous Page\\
\\
SvelteKit](https://www.better-auth.com/docs/integrations/svelte-kit) [Next Page\\
\\
TanStack Start](https://www.better-auth.com/docs/integrations/tanstack)

### On this page

[Mount the handler](https://www.better-auth.com/docs/integrations/solid-start#mount-the-handler)