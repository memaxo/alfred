---
title: Cloudflare Deployer
url: 
description: Learn how to deploy a Mastra application to Cloudflare using the Mastra CloudflareDeployer
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") [Serverless Platforms](https://mastra.ai/en/docs/deployment/serverless-platforms "Serverless Platforms") Cloudflare

Copy page

# CloudflareDeployer

The `CloudflareDeployer` class handles deployment of standalone Mastra applications to Cloudflare Workers. It manages configuration, deployment, and extends the base [Deployer](https://mastra.ai/reference/deployer/deployer) class with Cloudflare specific functionality.

## Installation [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer\#installation)

```nextra-code

npm install @mastra/deployer-cloudflare@latest
```

## Usage example [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer\#usage-example)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";

export const mastra = new Mastra({
  // ...
  deployer: new CloudflareDeployer({
    projectName: "hello-mastra",
    env: {
      NODE_ENV: "production",
    },
  }),
});
```

> See the [CloudflareDeployer](https://mastra.ai/reference/deployer/cloudflare) API reference for all available configuration options.

## Manual deployment [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer\#manual-deployment)

Manual deployments are also possible using the [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/). With the Wrangler CLI installed run the following from your project root to deploy your application.

With the Wrangler CLI installed, login and authenticate with your Cloudflare logins:

```nextra-code

npx wrangler login
```

Run the following to build and deploy your application to Cloudflare

```nextra-code

npm run build && wrangler deploy --config .mastra/output/wrangler.json
```

> You can also run `wrangler dev --config .mastra/output/wrangler.json` from your project root to test your Mastra application locally.

## Build output [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer\#build-output)

The build output for Mastra applications using the `CloudflareDeployer` includes all agents, tools, and workflows in your project, along with Mastra specific files required to run your application on Cloudflare.

- .mastra
  - output
    - index.mjs
    - wrangler.json
- package.json

The `CloudflareDeployer` automatically generates a `wrangler.json` configuration file in `.mastra/output` with the following settings:

```nextra-code

{
  "name": "hello-mastra",
  "main": "./index.mjs",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat", "nodejs_compat_populate_process_env"],
  "observability": { "logs": { "enabled": true } },
  "vars": {
    "OPENAI_API_KEY": "...",
    "CLOUDFLARE_API_TOKEN": "..."
  }
}

```

## Next steps [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer\#next-steps)

- [Mastra Client SDK](https://mastra.ai/docs/client-js/overview)

[Overview](https://mastra.ai/en/docs/deployment/serverless-platforms "Overview") [Netlify](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer "Netlify")