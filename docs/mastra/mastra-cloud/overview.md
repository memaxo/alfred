---
title: Mastra Cloud
url: 
description: Deployment and monitoring service for Mastra applications
language: en
---
[Skip to Content](https://mastra.ai/en/docs/mastra-cloud/overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") Mastra CloudOverview

Copy page

# Mastra Cloud

[Mastra Cloud](https://mastra.ai/cloud) is a platform for deploying, managing, monitoring, and debugging Mastra applications. When you [deploy](https://mastra.ai/docs/mastra-cloud/setting-up) your application, Mastra Cloud exposes your agents, tools, and workflows as REST API endpoints.

**Beta Notice**

Mastra Cloud is currently in **public beta**. Features, APIs, and UIs may change as development continues.

## Platform features [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/overview\#platform-features)

Deploy and manage your applications with automated builds, organized projects, and no additional configuration.

![Platform features](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-platform-features.68dc0c73.jpg&w=3840&q=75)

Key features:

Mastra Cloud supports zero-config deployment, continuous integration with GitHub, and atomic deployments that package agents, tools, and workflows together.

## Project Dashboard [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/overview\#project-dashboard)

Monitor and debug your applications with detailed output logs, deployment state, and interactive tools.

![Project dashboard](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-project-dashboard.6dcb5ec3.jpg&w=3840&q=75)

Key features:

The Project Dashboard gives you an overview of your application’s status and deployments, with access to logs and a built-in playground for testing agents and workflows.

## Project structure [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/overview\#project-structure)

Use a standard Mastra project structure for proper detection and deployment.

- src
  - mastra
    - agents
      - agent-name.ts
    - tools
      - tool-name.ts
    - workflows
      - workflow-name.ts
    - index.ts
- package.json

Mastra Cloud scans your repository for:

- **Agents**: Defined using: `new Agent({...})`
- **Tools**: Defined using: `createTool({...})`
- **Workflows**: Defined using: `createWorkflow({...})`
- **Steps**: Defined using: `createStep({...})`
- **Environment Variables**: API keys and configuration variables

## Technical implementation [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/overview\#technical-implementation)

Mastra Cloud is purpose-built for Mastra agents, tools, and workflows. It handles long-running requests, records detailed traces for every execution, and includes built-in support for evals.

## Next steps [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/overview\#next-steps)

- [Setting Up and Deploying](https://mastra.ai/docs/mastra-cloud/setting-up)

[Azure App Services](https://mastra.ai/en/docs/deployment/cloud-providers/azure-app-services "Azure App Services") [Setup & Deploy](https://mastra.ai/en/docs/mastra-cloud/setting-up "Setup & Deploy")