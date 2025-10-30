---
title: OpenTelemetry Exporter | AI Tracing | Observability | Mastra Docs
url: 
description: Send AI traces to any OpenTelemetry-compatible observability platform
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") [AI Tracing](https://mastra.ai/en/docs/observability/ai-tracing/overview "AI Tracing") [Exporters](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default "Exporters") OpenTelemetryexp.

Copy page

# OpenTelemetry Exporter

The OpenTelemetry exporter is currently **experimental**. APIs and configuration options may change in future releases.

The OpenTelemetry (OTEL) exporter sends your AI traces to any OTEL-compatible observability platform using standardized [OpenTelemetry Semantic Conventions for GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/). This ensures broad compatibility with platforms like Datadog, New Relic, SigNoz, Dash0, Traceloop, Laminar, and more.

## When to Use OTEL Exporter [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#when-to-use-otel-exporter)

The OTEL exporter is ideal when you need:

- **Platform flexibility** \- Send traces to any OTEL-compatible backend
- **Standards compliance** \- Follow OpenTelemetry GenAI semantic conventions
- **Multi-vendor support** \- Configure once, switch providers easily
- **Enterprise platforms** \- Integrate with existing observability infrastructure
- **Custom collectors** \- Send to your own OTEL collector

## Installation [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#installation)

Each provider requires specific protocol packages. Install the base exporter plus the protocol package for your provider:

### For HTTP/Protobuf Providers (SigNoz, New Relic, Laminar) [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#for-httpprotobuf-providers-signoz-new-relic-laminar)

npmpnpmyarnbun

```nextra-code

npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

```nextra-code

pnpm add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

```nextra-code

yarn add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

```nextra-code

bun add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

### For gRPC Providers (Dash0) [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#for-grpc-providers-dash0)

npmpnpmyarnbun

```nextra-code

npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
```

```nextra-code

pnpm add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
```

```nextra-code

yarn add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
```

```nextra-code

bun add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
```

### For HTTP/JSON Providers (Traceloop) [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#for-httpjson-providers-traceloop)

npmpnpmyarnbun

```nextra-code

npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-http
```

```nextra-code

pnpm add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-http
```

```nextra-code

yarn add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-http
```

```nextra-code

bun add @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-http
```

## Provider Configurations [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#provider-configurations)

### Dash0 [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#dash0)

[Dash0](https://www.dash0.com/) provides real-time observability with automatic insights.

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { OtelExporter } from "@mastra/otel-exporter";

export const mastra = new Mastra({
  observability: {
    configs: {
      otel: {
        serviceName: 'my-service',
        exporters: [\
          new OtelExporter({\
            provider: {\
              dash0: {\
                apiKey: process.env.DASH0_API_KEY,\
                endpoint: process.env.DASH0_ENDPOINT, // e.g., 'ingress.us-west-2.aws.dash0.com:4317'\
                dataset: 'production', // Optional dataset name\
              }\
            },\
          }),\
        ],
      },
    },
  },
});
```

Get your Dash0 endpoint from your dashboard. It should be in the format `ingress.{region}.aws.dash0.com:4317`.

### SigNoz [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#signoz)

[SigNoz](https://signoz.io/) is an open-source APM alternative with built-in AI tracing support.

src/mastra/index.ts

```nextra-code

new OtelExporter({
  provider: {
    signoz: {
      apiKey: process.env.SIGNOZ_API_KEY,
      region: 'us', // 'us' | 'eu' | 'in'
      // endpoint: 'https://my-signoz.example.com', // For self-hosted
    }
  },
})
```

### New Relic [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#new-relic)

[New Relic](https://newrelic.com/) provides comprehensive observability with AI monitoring capabilities.

src/mastra/index.ts

```nextra-code

new OtelExporter({
  provider: {
    newrelic: {
      apiKey: process.env.NEW_RELIC_LICENSE_KEY,
      // endpoint: 'https://otlp.eu01.nr-data.net', // For EU region
    }
  },
})
```

### Traceloop [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#traceloop)

[Traceloop](https://www.traceloop.com/) specializes in LLM observability with automatic prompt tracking.

src/mastra/index.ts

```nextra-code

new OtelExporter({
  provider: {
    traceloop: {
      apiKey: process.env.TRACELOOP_API_KEY,
      destinationId: 'my-destination', // Optional
    }
  },
})
```

### Laminar [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#laminar)

[Laminar](https://www.lmnr.ai/) provides specialized LLM observability and analytics.

src/mastra/index.ts

```nextra-code

new OtelExporter({
  provider: {
    laminar: {
      apiKey: process.env.LMNR_PROJECT_API_KEY,
      // teamId: process.env.LAMINAR_TEAM_ID, // Optional, for backwards compatibility
    }
  },
})
```

### Custom/Generic OTEL Endpoints [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#customgeneric-otel-endpoints)

For other OTEL-compatible platforms or custom collectors:

src/mastra/index.ts

```nextra-code

new OtelExporter({
  provider: {
    custom: {
      endpoint: 'https://your-collector.example.com/v1/traces',
      protocol: 'http/protobuf', // 'http/json' | 'http/protobuf' | 'grpc'
      headers: {
        'x-api-key': process.env.API_KEY,
      },
    }
  },
})
```

## Configuration Options [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#configuration-options)

### Complete Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#complete-configuration)

```nextra-code

new OtelExporter({
  // Provider configuration (required)
  provider: {
    // Use one of: dash0, signoz, newrelic, traceloop, laminar, custom
  },

  // Export configuration
  timeout: 30000,        // Export timeout in milliseconds
  batchSize: 100,        // Number of spans per batch

  // Debug options
  logLevel: 'info',      // 'debug' | 'info' | 'warn' | 'error'
})
```

## OpenTelemetry Semantic Conventions [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#opentelemetry-semantic-conventions)

The exporter follows [OpenTelemetry Semantic Conventions for GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/), ensuring compatibility with observability platforms:

### Span Naming [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#span-naming)

- **LLM Operations**: `chat {model}` or `tool_selection {model}`
- **Tool Execution**: `tool.execute {tool_name}`
- **Agent Runs**: `agent.{agent_id}`
- **Workflow Runs**: `workflow.{workflow_id}`

### Key Attributes [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#key-attributes)

- `gen_ai.operation.name` \- Operation type (chat, tool.execute, etc.)
- `gen_ai.system` \- AI provider (openai, anthropic, etc.)
- `gen_ai.request.model` \- Model identifier
- `gen_ai.usage.input_tokens` \- Number of input tokens
- `gen_ai.usage.output_tokens` \- Number of output tokens
- `gen_ai.request.temperature` \- Sampling temperature
- `gen_ai.response.finish_reasons` \- Completion reason

## Buffering Strategy [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#buffering-strategy)

The exporter buffers spans until a trace is complete:

1. Collects all spans for a trace
2. Waits 5 seconds after root span completes
3. Exports complete trace with preserved parent-child relationships
4. Ensures no orphaned spans

## Protocol Selection Guide [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#protocol-selection-guide)

Choose the right protocol package based on your provider:

| Provider | Protocol | Required Package |
| --- | --- | --- |
| Dash0 | gRPC | `@opentelemetry/exporter-trace-otlp-grpc` |
| SigNoz | HTTP/Protobuf | `@opentelemetry/exporter-trace-otlp-proto` |
| New Relic | HTTP/Protobuf | `@opentelemetry/exporter-trace-otlp-proto` |
| Traceloop | HTTP/JSON | `@opentelemetry/exporter-trace-otlp-http` |
| Laminar | HTTP/Protobuf | `@opentelemetry/exporter-trace-otlp-proto` |
| Custom | Varies | Depends on your collector |

Make sure to install the correct protocol package for your provider. The exporter will provide a helpful error message if the wrong package is installed.

## Troubleshooting [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#troubleshooting)

### Missing Dependency Error [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#missing-dependency-error)

If you see an error like:

```nextra-code

HTTP/Protobuf exporter is not installed (required for signoz).
To use HTTP/Protobuf export, install the required package:
  npm install @opentelemetry/exporter-trace-otlp-proto
```

Install the suggested package for your provider.

### Common Issues [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#common-issues)

1. **Wrong protocol package**: Verify you installed the correct exporter for your provider
2. **Invalid endpoint**: Check endpoint format matches provider requirements
3. **Authentication failures**: Verify API keys and headers are correct
4. **No traces appearing**: Check that traces complete (root span must end)

## Related [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel\#related)

- [AI Tracing Overview](https://mastra.ai/docs/observability/ai-tracing/overview)
- [OpenTelemetry GenAI Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [OTEL Exporter Reference](https://mastra.ai/reference/observability/ai-tracing/exporters/otel)

[LangSmithexp.](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith "LangSmith") [SensitiveDataFilter](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter "SensitiveDataFilter")