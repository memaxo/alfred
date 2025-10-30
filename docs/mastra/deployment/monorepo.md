---
title: Monorepo Deployment
url: 
description: Learn how to deploy Mastra applications that are part of a monorepo setup
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/monorepo#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") With a Monorepo

Copy page

# Monorepo Deployment

Deploying Mastra in a monorepo follows the same approach as deploying a standalone application. While some [Cloud](https://mastra.ai/en/docs/deployment/cloud-providers/) or [Serverless Platform](https://mastra.ai/en/docs/deployment/serverless-platforms/) providers may introduce extra requirements, the core setup is the same.

## Example monorepo [Permalink for this section](https://mastra.ai/en/docs/deployment/monorepo\#example-monorepo)

In this example, the Mastra application is located at `apps/api`.

- apps
  - api
    - src
      - mastra
        - agents
        - tools
        - workflows
        - index.ts
    - package.json
    - tsconfig.json
  - web
- packages
  - ui
  - utils
- package.json

## Environment variables [Permalink for this section](https://mastra.ai/en/docs/deployment/monorepo\#environment-variables)

Environment variables like `OPENAI_API_KEY` should be stored in an `.env` file at the root of the Mastra application `(apps/api)`, for example:

- api
  - src
    - mastra
  - .env
  - package.json
  - tsconfig.json

## Deployment configuration [Permalink for this section](https://mastra.ai/en/docs/deployment/monorepo\#deployment-configuration)

The image below shows how to select `apps/api` as the project root when deploying to [Mastra Cloud](https://mastra.ai/en/docs/mastra-cloud/overview). While the interface may differ between providers, the configuration remains the same.

![Deployment configuration](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmonorepo-mastra-cloud.d61a9e9d.jpg&w=3840&q=75)

## Dependency management [Permalink for this section](https://mastra.ai/en/docs/deployment/monorepo\#dependency-management)

In a monorepo, keep dependencies consistent to avoid version conflicts and build errors.

- Use a **single lockfile** at the project root so all packages resolve the same versions.
- Align versions of **shared libraries** (like Mastra or frameworks) to prevent duplicates.

## Deployment pitfalls [Permalink for this section](https://mastra.ai/en/docs/deployment/monorepo\#deployment-pitfalls)

Common issues to watch for when deploying Mastra in a monorepo:

- **Wrong project root**: make sure the correct package (e.g. `apps/api`) is selected as the deploy target.

## Bundler options [Permalink for this section](https://mastra.ai/en/docs/deployment/monorepo\#bundler-options)

Use `transpilePackages` to compile TypeScript workspace packages or libraries. List package names exactly as they appear in each `package.json`. Use `externals` to exclude dependencies resolved at runtime, and `sourcemap` to emit readable stack traces.

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  // ...
  bundler: {
    transpilePackages: ["utils"],
    externals: ["ui"],
    sourcemap: true
  }
});
```

> See [Mastra Class](https://mastra.ai/en/reference/core/mastra-class) for more configuration options.

## Supported monorepos [Permalink for this section](https://mastra.ai/en/docs/deployment/monorepo\#supported-monorepos)

Mastra works with:

- npm workspaces
- pnpm workspaces
- Yarn workspaces
- Turborepo

Known limitations:

- Bun workspaces — partial support; known issues
- Nx — You can use Nx’s [supported dependency strategies](https://nx.dev/concepts/decisions/dependency-management) but you need to have `package.json` files inside your workspace packages

> If you are experiencing issues with monorepos see our: [Monorepos Support mega issue](https://github.com/mastra-ai/mastra/issues/6852).

[Server deployment](https://mastra.ai/en/docs/deployment/server-deployment "Server deployment") [With a Web Framework](https://mastra.ai/en/docs/deployment/web-framework "With a Web Framework")