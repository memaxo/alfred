---
title: Cloud Providers
url: 
description: Deploy your Mastra applications to popular cloud providers.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/cloud-providers#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") Cloud ProvidersOverview

Copy page

## Cloud Providers [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers\#cloud-providers)

Standalone Mastra applications can be deployed to popular cloud providers, see one of the following guides for more information:

- [Amazon EC2](https://mastra.ai/docs/deployment/cloud-providers/amazon-ec2)
- [AWS Lambda](https://mastra.ai/docs/deployment/cloud-providers/aws-lambda)
- [Digital Ocean](https://mastra.ai/docs/deployment/cloud-providers/digital-ocean)
- [Azure App Services](https://mastra.ai/docs/deployment/cloud-providers/azure-app-services)

For self-hosted Node.js server deployment, see the [Creating A Mastra Server](https://mastra.ai/docs/deployment/server) guide.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers\#prerequisites)

Before deploying to a cloud provider, ensure you have:

- A [Mastra application](https://mastra.ai/docs/getting-started/installation)
- Node.js `v20.0` or higher
- A GitHub repository for your application (required for most CI/CD setups)
- Domain name management access (for SSL and HTTPS)
- Basic familiarity with server setup (e.g. Nginx, environment variables)

## LibSQLStore [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers\#libsqlstore)

`LibSQLStore` writes to the local filesystem, which is not supported in cloud environments that use ephemeral file systems. If you’re deploying to platforms like **AWS Lambda**, **Azure App Services**, or **Digital Ocean App Platform**, you **must remove** all usage of `LibSQLStore`.

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

[Vercel](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer "Vercel") [Amazon EC2](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2 "Amazon EC2")