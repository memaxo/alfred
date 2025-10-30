---
title: Overview | Observability | Mastra Docs
url: 
description: Monitor and debug applications with Mastra's Observability features.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") ObservabilityOverview

Copy page

# Observability Overview

Mastra provides comprehensive observability features designed specifically for AI applications. Monitor LLM operations, trace agent decisions, and debug complex workflows with specialized tools that understand AI-specific patterns.

## Key Features [Permalink for this section](https://mastra.ai/en/docs/observability/overview\#key-features)

### Structured Logging [Permalink for this section](https://mastra.ai/en/docs/observability/overview\#structured-logging)

Debug applications with contextual logging:

- **Context propagation**: Automatic correlation with traces
- **Configurable levels**: Filter by severity in development and production

### AI Tracing [Permalink for this section](https://mastra.ai/en/docs/observability/overview\#ai-tracing)

Specialized tracing for AI operations that captures:

- **LLM interactions**: Token usage, latency, prompts, and completions
- **Agent execution**: Decision paths, tool calls, and memory operations
- **Workflow steps**: Branching logic, parallel execution, and step outputs
- **Automatic instrumentation**: Zero-configuration tracing with decorators

### OTEL Tracing [Permalink for this section](https://mastra.ai/en/docs/observability/overview\#otel-tracing)

Traditional distributed tracing with OpenTelemetry:

- **Standard OTLP protocol**: Compatible with existing observability infrastructure
- **HTTP and database instrumentation**: Automatic spans for common operations
- **Provider integrations**: Datadog, New Relic, Jaeger, and other OTLP collectors
- **Distributed context**: W3C Trace Context propagation

## Quick Start [Permalink for this section](https://mastra.ai/en/docs/observability/overview\#quick-start)

Configure Observability in your Mastra instance:

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/core";
import { LibSqlStorage } from "@mastra/libsql";

export const mastra = new Mastra({
  // ... other config
  logger: new PinoLogger(),
  observability: {
    default: { enabled: true }, // Enables AI Tracing
  },
  storage: new LibSQLStore({
    url: "file:./mastra.db", // Storage is required for tracing
  }),
  telemetry: {
    enabled: true, // Enables OTEL Tracing
  }
});
```

With this basic setup, you will see Traces and Logs in both the Playground and in Mastra Cloud.

We also support various external tracing providers like Langfuse, Braintrust, and any OpenTelemetry-compatible platform (Datadog, New Relic, SigNoz, etc.). See more about this in the [AI Tracing](https://mastra.ai/docs/observability/ai-tracing) documentation.

## What’s Next? [Permalink for this section](https://mastra.ai/en/docs/observability/overview\#whats-next)

- **[Set up AI Tracing](https://mastra.ai/docs/observability/ai-tracing)**: Configure tracing for your application
- **[Configure Logging](https://mastra.ai/docs/observability/logging)**: Add structured logging
- **[View Examples](https://mastra.ai/examples/observability/basic-ai-tracing)**: See observability in action
- **[API Reference](https://mastra.ai/reference/observability/ai-tracing/ai-tracing)**: Detailed configuration options

[Observability](https://mastra.ai/en/docs/mastra-cloud/observability "Observability") [Logging](https://mastra.ai/en/docs/observability/logging "Logging")