---
title: Understanding the Mastra Cloud Dashboard
url: 
description: Details of each feature available in Mastra Cloud
language: en
---
[Skip to Content](https://mastra.ai/en/docs/mastra-cloud/dashboard#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Mastra Cloud](https://mastra.ai/en/docs/mastra-cloud/overview "Mastra Cloud") Dashboard

Copy page

# Navigating the Dashboard

This page explains how to navigate the Mastra Cloud dashboard, where you can configure your project, view deployment details, and interact with agents and workflows using the built-in [Playground](https://mastra.ai/docs/mastra-cloud/dashboard#playground).

**Beta Notice**

Mastra Cloud is currently in **public beta**. Features, APIs, and UIs may change as development continues.

## Overview [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#overview)

The **Overview** page provides details about your application, including its domain URL, status, latest deployment, and connected agents and workflows.

![Project dashboard](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-project-dashboard.6dcb5ec3.jpg&w=3840&q=75)

Key features:

Each project shows its current deployment status, active domains, and environment variables, so you can quickly understand how your application is running.

## Deployments [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#deployments)

The **Deployments** page shows recent builds and gives you quick access to detailed build logs. Click any row to view more information about a specific deployment.

![Dashboard deployment](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-deployments.26d5164c.jpg&w=3840&q=75)

Key features:

Each deployment includes its current status, the Git branch it was deployed from, and a title generated from the commit hash.

## Logs [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#logs)

The **Logs** page is where you’ll find detailed information to help debug and monitor your application’s behavior in the production environment.

![Dashboard logs](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-logs.7b572f71.jpg&w=3840&q=75)

Key features:

Each log includes a severity level and detailed messages showing agent, workflow, and storage activity.

## Settings [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#settings)

On the **Settings** page you can modify the configuration of your application.

![Dashboard settings](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-settings.be4ff0cc.jpg&w=3840&q=75)

Key features:

You can manage environment variables, edit key project settings like the name and branch, configure storage with LibSQLStore, and set a stable URL for your endpoints.

> Changes to configuration require a new deployment before taking effect.

## Playground [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#playground)

### Agents [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#agents)

On the **Agents** page you’ll see all agents used in your application. Click any agent to interact using the chat interface.

![Dashboard playground agents](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-playground-agents.3a789947.jpg&w=3840&q=75)

Key features:

Test your agents in real time using the chat interface, review traces of each interaction, and see evaluation scores for every response.

### Workflows [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#workflows)

On the **Workflows** page you’ll see all workflows used in your application. Click any workflow to interact using the runner interface.

![Dashboard playground workflows](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-playground-workflows.37e3d7a5.jpg&w=3840&q=75)

Key features:

Visualize your workflow with a step-by-step graph, view execution traces, and run workflows directly using the built-in runner.

### Tools [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#tools)

On the **Tools** page you’ll see all tools used by your agents. Click any tool to interact using the input interface.

![Dashboard playground tools](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-playground-tools.8b102725.jpg&w=3840&q=75)

Key features:

Test your tools by providing an input that matches the schema and viewing the structured output.

## MCP Servers [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#mcp-servers)

The **MCP Servers** page lists all MCP Servers included in your application. Click any MCP Server for more information.

![Dashboard playground mcp servers](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-playground-mcpservers.6fd6fdc7.jpg&w=3840&q=75)

Key features:

Each MCP Server includes API endpoints for HTTP and SSE, along with IDE configuration snippets for tools like Cursor and Windsurf.

## Next steps [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/dashboard\#next-steps)

- [Understanding Tracing and Logs](https://mastra.ai/docs/mastra-cloud/observability)

[Setup & Deploy](https://mastra.ai/en/docs/mastra-cloud/setting-up "Setup & Deploy") [Observability](https://mastra.ai/en/docs/mastra-cloud/observability "Observability")