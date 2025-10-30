---
title: Deployment Overview
url: 
description: Learn about different deployment options for your Mastra applications
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/overview#nextra-skip-nav)

Loading...

[Docs](https://mastra.ai/en/docs "Docs") DeploymentOverview

Copy page

# Deployment Overview

Mastra offers multiple deployment options to suit your application’s needs, from fully-managed solutions to self-hosted options, and web framework integrations. This guide will help you understand the available deployment paths and choose the right one for your project.

## Deployment Options [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#deployment-options)

### Runtime support [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#runtime-support)

- Node.js `v20.0` or higher
- Bun
- Deno
- [Cloudflare](https://mastra.ai/en/docs/deployment/serverless-platforms/cloudflare-deployer)

### Mastra Cloud [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#mastra-cloud)

Mastra Cloud is a deployment platform that connects to your GitHub repository, automatically deploys on code changes, and provides monitoring tools. It includes:

- GitHub repository integration
- Deployment on git push
- Agent testing interface
- Comprehensive logs and traces
- Custom domains for each project

[View Mastra Cloud documentation →](https://mastra.ai/en/docs/mastra-cloud/overview)

### With a Web Framework [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#with-a-web-framework)

Mastra can be integrated with a variety of web frameworks. For example, see one of the following for a detailed guide.

- [With Next.js](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js)
- [With Astro](https://mastra.ai/en/docs/frameworks/web-frameworks/astro)

When integrated with a framework, Mastra typically requires no additional configuration for deployment.

[View Web Framework Integration →](https://mastra.ai/en/docs/deployment/web-framework)

### With a Server [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#with-a-server)

You can deploy Mastra as a standard Node.js HTTP server, which gives you full control over your infrastructure and deployment environment.

- Custom API routes and middleware
- Configurable CORS and authentication
- Deploy to VMs, containers, or PaaS platforms
- Ideal for integrating with existing Node.js applications

[Server deployment guide →](https://mastra.ai/en/docs/deployment/server-deployment)

### Serverless Platforms [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#serverless-platforms)

Mastra provides platform-specific deployers for popular serverless platforms, enabling you to deploy your application with minimal configuration.

- Deploy to Cloudflare Workers, Vercel, or Netlify
- Platform-specific optimizations
- Simplified deployment process
- Automatic scaling through the platform

[Serverless deployment guide →](https://mastra.ai/en/docs/deployment/server-deployment)

## Client Configuration [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#client-configuration)

Once your Mastra application is deployed, you’ll need to configure your client to communicate with it. The Mastra Client SDK provides a simple and type-safe interface for interacting with your Mastra server.

- Type-safe API interactions
- Authentication and request handling
- Retries and error handling
- Support for streaming responses

[Client configuration guide →](https://mastra.ai/en/docs/server-db/mastra-client)

## Choosing a Deployment Option [Permalink for this section](https://mastra.ai/en/docs/deployment/overview\#choosing-a-deployment-option)

| Option | Best For | Key Benefits |
| --- | --- | --- |
| **Mastra Cloud** | Teams wanting to ship quickly without infrastructure concerns | Fully-managed, automatic scaling, built-in observability |
| **Framework Deployment** | Teams already using Next.js, Astro etc | Simplify deployment with a unified codebase for frontend and backend |
| **Server Deployment** | Teams needing maximum control and customization | Full control, custom middleware, integrate with existing apps |
| **Serverless Platforms** | Teams already using Vercel, Netlify, or Cloudflare | Platform integration, simplified deployment, automatic scaling |

[Mastra Client](https://mastra.ai/en/docs/server-db/mastra-client "Mastra Client") [Server deployment](https://mastra.ai/en/docs/deployment/server-deployment "Server deployment")