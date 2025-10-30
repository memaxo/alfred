---
title: Deploying Mastra with a Web Framework
url: 
description: Learn how Mastra can be deployed when integrated with a Web Framework
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/web-framework#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") With a Web Framework

Copy page

# Web Framework Integration

This guide covers deploying integrated Mastra applications. Mastra can be integrated with a variety of web frameworks, see one of the following for a detailed guide.

- [With Next.js](https://mastra.ai/docs/frameworks/web-frameworks/next-js)
- [With Astro](https://mastra.ai/docs/frameworks/web-frameworks/astro)

When integrated with a framework, Mastra typically requires no additional configuration for deployment.

## With Next.js on Vercel [Permalink for this section](https://mastra.ai/en/docs/deployment/web-framework\#with-nextjs-on-vercel)

If you’ve integrated Mastra with Next.js [by following our guide](https://mastra.ai/docs/frameworks/web-frameworks/next-js) and plan to deploy to Vercel, no additional setup is required.

The only thing to verify is that you’ve added the following to your `next.config.ts` and removed any usage of [LibSQLStore](https://mastra.ai/docs/deployment/deployment#libsqlstore), which is not supported in serverless environments:

next.config.ts

```nextra-code [counter-reset:line]

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mastra/*"],
};

export default nextConfig;
```

## With Astro on Vercel [Permalink for this section](https://mastra.ai/en/docs/deployment/web-framework\#with-astro-on-vercel)

If you’ve integrated Mastra with Astro [by following our guide](https://mastra.ai/docs/frameworks/web-frameworks/astro) and plan to deploy to Vercel, no additional setup is required.

The only thing to verify is that you’ve added the following to your `astro.config.mjs` and removed any usage of [LibSQLStore](https://mastra.ai/docs/deployment/deployment#libsqlstore), which is not supported in serverless environments:

astro.config.mjs

```nextra-code [counter-reset:line]

import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // ...
  adapter: vercel(),
  output: "server"
});
```

## With Astro on Netlify [Permalink for this section](https://mastra.ai/en/docs/deployment/web-framework\#with-astro-on-netlify)

If you’ve integrated Mastra with Astro [by following our guide](https://mastra.ai/docs/frameworks/web-frameworks/astro) and plan to deploy to Vercel, no additional setup is required.

The only thing to verify is that you’ve added the following to your `astro.config.mjs` and removed any usage of [LibSQLStore](https://mastra.ai/docs/deployment/deployment#libsqlstore), which is not supported in serverless environments:

astro.config.mjs

```nextra-code [counter-reset:line]

import { defineConfig } from 'astro/config';
import vercel from '@astrojs/netlify';

export default defineConfig({
  // ...
  adapter: netlify(),
  output: "server"
});
```

[With a Monorepo](https://mastra.ai/en/docs/deployment/monorepo "With a Monorepo") [Overview](https://mastra.ai/en/docs/deployment/serverless-platforms "Overview")