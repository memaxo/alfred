---
title: Vercel Deployer
url: 
description: Learn how to deploy a Mastra application to Vercel using the Mastra VercelDeployer
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") [Serverless Platforms](https://mastra.ai/en/docs/deployment/serverless-platforms "Serverless Platforms") Vercel

Copy page

# VercelDeployer

The `VercelDeployer` class handles deployment of standalone Mastra applications to Vercel. It manages configuration, deployment, and extends the base [Deployer](https://mastra.ai/reference/deployer/deployer) class with Vercel specific functionality.

## Installation [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#installation)

```nextra-code

npm install @mastra/deployer-vercel@latest
```

## Usage example [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#usage-example)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { VercelDeployer } from "@mastra/deployer-vercel";

export const mastra = new Mastra({
  // ...
  deployer: new VercelDeployer()
});
```

> See the [VercelDeployer](https://mastra.ai/reference/deployer/vercel) API reference for all available configuration options.

### Optional overrides [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#optional-overrides)

The Vercel deployer can write a few high‑value settings into the Vercel Output API function config ( `.vc-config.json`):

- `maxDuration?: number` — Function execution timeout (seconds)
- `memory?: number` — Function memory allocation (MB)
- `regions?: string[]` — Regions (e.g. `['sfo1','iad1']`)

Example:

src/mastra/index.ts

```nextra-code [counter-reset:line]

deployer: new VercelDeployer({
  maxDuration: 600,
  memory: 1536,
  regions: ["sfo1", "iad1"],
})
```

## Continuous integration [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#continuous-integration)

After connecting your Mastra project’s Git repository to Vercel, update the project settings. In the Vercel dashboard, go to **Settings** \> **Build and Deployment**, and under **Framework settings**, set the following:

- **Build command**: `npm run build` (optional)

### Environment variables [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#environment-variables)

Before your first deployment, make sure to add any environment variables used by your application. For example, if you’re using OpenAI as the LLM, you’ll need to set `OPENAI_API_KEY` in your Vercel project settings.

> See [Environment variables](https://vercel.com/docs/environment-variables) for more details.

Your project is now configured with automatic deployments which occur whenever you push to the configured branch of your GitHub repository.

## Manual deployment [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#manual-deployment)

Manual deployments are also possible using the [Vercel CLI](https://vercel.com/docs/cli). With the Vercel CLI installed run the following from your project root to deploy your application.

```nextra-code

npm run build && vercel --prod --prebuilt --archive=tgz
```

> You can also run `vercel dev` from your project root to test your Mastra application locally.

## Build output [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#build-output)

The build output for Mastra applications using the `VercelDeployer` includes all agents, tools, and workflows in your project, along with Mastra specific files required to run your application on Vercel.

- .vercel
  - output
    - functions
      - index.func
        - index.mjs
    - config.json
- package.json

The `VercelDeployer` automatically generates a `config.json` configuration file in `.vercel/output` with the following settings:

```nextra-code

{
  "version": 3,
  "routes": [\
    {\
      "src": "/(.*)",\
      "dest": "/"\
    }\
  ]
}
```

## Next steps [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer\#next-steps)

- [Mastra Client SDK](https://mastra.ai/docs/client-js/overview)

[Netlify](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer "Netlify") [Overview](https://mastra.ai/en/docs/deployment/cloud-providers "Overview")