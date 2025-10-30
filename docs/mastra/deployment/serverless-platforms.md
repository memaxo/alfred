---
title: Serverless Deployment
url: 
description: Build and deploy Mastra applications using platform-specific deployers or standard HTTP servers
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/serverless-platforms#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") Serverless PlatformsOverview

Copy page

# Serverless Deployment

Standalone Mastra applications can be deployed to popular serverless platforms using one of our deployer packages:

- [Cloudflare](https://mastra.ai/docs/deployment/serverless-platforms/cloudflare-deployer)
- [Netlify](https://mastra.ai/docs/deployment/serverless-platforms/netlify-deployer)
- [Vercel](https://mastra.ai/docs/deployment/serverless-platforms/vercel-deployer)

Deployers **aren’t** required when integrating Mastra with a framework. See [Web Framework Integration](https://mastra.ai/docs/deployment/web-framework) for more information.

For self-hosted Node.js server deployment, see the [Creating A Mastra Server](https://mastra.ai/docs/deployment/server) guide.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms\#prerequisites)

Before you begin, ensure you have:

- Node.js `v20.0` or higher
- If using a platform-specific deployer:
  - An account with your chosen platform
  - Required API keys or credentials

## LibSQLStore [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms\#libsqlstore)

`LibSQLStore` writes to the local filesystem, which is not supported in serverless environments due to their ephemeral nature. If you’re deploying to a platform like Vercel, Netlify or Cloudflare, you **must remove** all usage of `LibSQLStore`.

Specifically, ensure you’ve removed it from both `src/mastra/index.ts` and `src/mastra/agents/weather-agent.ts`:

src/mastra/index.ts

```nextra-code [counter-reset:line]

export const mastra = new Mastra({
  // ...
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  })
});
```

src/mastra/agents/weather-agent.ts

```nextra-code [counter-reset:line]

export const weatherAgent = new Agent({
 // ..
 memory: new Memory({
   storage: new LibSQLStore({
      url: "file:../mastra.db" // path is relative to the .mastra/output directory
   })
 })
});
```

[With a Web Framework](https://mastra.ai/en/docs/deployment/web-framework "With a Web Framework") [Cloudflare](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer "Cloudflare")