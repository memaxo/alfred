---
title: Netlify Deployer
url: 
description: Learn how to deploy a Mastra application to Netlify using the Mastra NetlifyDeployer
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") [Serverless Platforms](https://mastra.ai/en/docs/deployment/serverless-platforms "Serverless Platforms") Netlify

Copy page

# NetlifyDeployer

The `NetlifyDeployer` class handles deployment of standalone Mastra applications to Netlify. It manages configuration, deployment, and extends the base [Deployer](https://mastra.ai/reference/deployer/deployer) class with Netlify specific functionality.

## Installation [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer\#installation)

```nextra-code

npm install @mastra/deployer-netlify@latest
```

## Usage example [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer\#usage-example)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { NetlifyDeployer } from "@mastra/deployer-netlify";

export const mastra = new Mastra({
  // ...
  deployer: new NetlifyDeployer()
});
```

> See the [NetlifyDeployer](https://mastra.ai/reference/deployer/netlify) API reference for all available configuration options.

## Continuous integration [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer\#continuous-integration)

After connecting your Mastra project’s Git repository to Netlify, update the project settings. In the Netlify dashboard, go to **Project configuration** \> **Build & deploy** \> **Continuous deployment**, and under **Build settings**, set the following:

- **Build command**: `npm run build` (optional)

### Environment variables [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer\#environment-variables)

Before your first deployment, make sure to add any environment variables used by your application. For example, if you’re using OpenAI as the LLM, you’ll need to set `OPENAI_API_KEY` in your Netlify project settings.

> See [Environment variables overview](https://docs.netlify.com/environment-variables/overview/) for more details.

Your project is now configured with automatic deployments which occur whenever you push to the configured branch of your GitHub repository.

## Manual deployment [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer\#manual-deployment)

Manual deployments are also possible using the [Netlify CLI](https://docs.netlify.com/cli/get-started/). With the Netlify CLI installed run the following from your project root to deploy your application.

```nextra-code

netlify deploy --prod
```

> You can also run `netlify dev` from your project root to test your Mastra application locally.

## Build output [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer\#build-output)

The build output for Mastra applications using the `NetlifyDeployer` includes all agents, tools, and workflows in your project, along with Mastra specific files required to run your application on Netlify.

- .netlify
  - v1
    - functions
      - api
        - index.mjs
    - config.json
- package.json

The `NetlifyDeployer` automatically generates a `config.json` configuration file in `.netlify/v1` with the following settings:

```nextra-code

{
  "redirects": [\
    {\
      "force": true,\
      "from": "/*",\
      "to": "/.netlify/functions/api/:splat",\
      "status": 200\
    }\
  ]
}
```

## Next steps [Permalink for this section](https://mastra.ai/en/docs/deployment/serverless-platforms/netlify-deployer\#next-steps)

- [Mastra Client SDK](https://mastra.ai/docs/client-js/overview)

[Cloudflare](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer "Cloudflare") [Vercel](https://mastra.ai/en/docs/deployment/serverless-platforms/vercel-deployer "Vercel")