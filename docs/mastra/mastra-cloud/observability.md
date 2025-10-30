---
title: Observability in Mastra Cloud
url: 
description: Monitoring and debugging tools for Mastra Cloud deployments
language: en
---
[Skip to Content](https://mastra.ai/en/docs/mastra-cloud/observability#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Mastra Cloud](https://mastra.ai/en/docs/mastra-cloud/overview "Mastra Cloud") Observability

Copy page

# Understanding Tracing and Logs

Mastra Cloud captures execution data to help you monitor your application’s behavior in the production environment.

**Beta Notice**

Mastra Cloud is currently in **public beta**. Features, APIs, and UIs may change as development continues.

## Logs [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/observability\#logs)

You can view detailed logs for debugging and monitoring your application’s behavior on the [Logs](https://mastra.ai/docs/mastra-cloud/dashboard#logs) page of the Dashboard.

![Dashboard logs](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-dashboard-logs.7b572f71.jpg&w=3840&q=75)

Key features:

Each log entry includes its severity level and a detailed message showing agent, workflow, or storage activity.

## Traces [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/observability\#traces)

More detailed traces are available for both agents and workflows by using a [logger](https://mastra.ai/docs/observability/logging) or enabling [telemetry](https://mastra.ai/docs/observability/tracing) using one of our [supported providers](https://mastra.ai/reference/observability/providers).

### Agents [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/observability\#agents)

With a [logger](https://mastra.ai/docs/observability/logging) enabled, you can view detailed outputs from your agents in the **Traces** section of the Agents Playground.

![observability agents](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-observability-agents.afb44661.jpg&w=3840&q=75)

Key features:

Tools passed to the agent during generation are standardized using `convertTools`. This includes retrieving client-side tools, memory tools, and tools exposed from workflows.

### Workflows [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/observability\#workflows)

With a [logger](https://mastra.ai/docs/observability/logging) enabled, you can view detailed outputs from your workflows in the **Traces** section of the Workflows Playground.

![observability workflows](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-observability-workflows.4db23e17.jpg&w=3840&q=75)

Key features:

Workflows are created using `createWorkflow`, which sets up steps, metadata, and tools. You can run them with `runWorkflow` by passing input and options.

## Next steps [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/observability\#next-steps)

- [Logging](https://mastra.ai/docs/observability/logging)
- [Tracing](https://mastra.ai/docs/observability/tracing)

[Dashboard](https://mastra.ai/en/docs/mastra-cloud/dashboard "Dashboard") [Overview](https://mastra.ai/en/docs/observability/overview "Overview")