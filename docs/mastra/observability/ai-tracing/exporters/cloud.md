---
title: Cloud Exporter | AI Tracing | Observability | Mastra Docs
url: 
description: Send traces to Mastra Cloud for production monitoring
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") [AI Tracing](https://mastra.ai/en/docs/observability/ai-tracing/overview "AI Tracing") [Exporters](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default "Exporters") Cloud

Copy page

# Cloud Exporter

The `CloudExporter` sends traces to Mastra Cloud for centralized monitoring and team collaboration. It’s automatically enabled when using the default observability configuration with a valid access token.

## When to Use CloudExporter [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#when-to-use-cloudexporter)

CloudExporter is ideal for:

- **Production monitoring** \- Centralized trace visualization
- **Team collaboration** \- Share traces across your organization
- **Advanced analytics** \- Insights and performance metrics
- **Zero maintenance** \- No infrastructure to manage

## Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#configuration)

### Prerequisites [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#prerequisites)

1. **Mastra Cloud Account**: Sign up at [cloud.mastra.ai](https://cloud.mastra.ai/)
2. **Access Token**: Generate in Mastra Cloud → Settings → API Tokens
3. **Environment Variables**: Set your credentials:

.env

```nextra-code

MASTRA_CLOUD_ACCESS_TOKEN=mst_xxxxxxxxxxxxxxxx
```

### Basic Setup [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#basic-setup)

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { CloudExporter } from "@mastra/core/ai-tracing";

export const mastra = new Mastra({
  observability: {
    configs: {
      production: {
        serviceName: 'my-service',
        exporters: [\
          new CloudExporter(),  // Uses MASTRA_CLOUD_ACCESS_TOKEN env var\
        ],
      },
    },
  },
});
```

### Automatic Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#automatic-configuration)

When using the default observability configuration, CloudExporter is automatically included if the access token is set:

```nextra-code

export const mastra = new Mastra({
  observability: {
    default: { enabled: true },  // Automatically includes CloudExporter if token exists
  },
});
```

### Complete Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#complete-configuration)

```nextra-code

new CloudExporter({
  // Optional - defaults to env var
  accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN,

  // Optional - for self-hosted Mastra Cloud
  endpoint: 'https://cloud.your-domain.com',

  // Batching configuration
  maxBatchSize: 1000,     // Max spans per batch
  maxBatchWaitMs: 5000,   // Max wait before sending batch

  // Diagnostic logging
  logLevel: 'info',  // debug | info | warn | error
})
```

## Viewing Traces [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#viewing-traces)

### Mastra Cloud Dashboard [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#mastra-cloud-dashboard)

1. Navigate to [cloud.mastra.ai](https://cloud.mastra.ai/)
2. Select your project
3. Go to Observability → Traces
4. Use filters to find specific traces:
   - Service name
   - Time range
   - Trace ID
   - Error status

### Features [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#features)

- **Trace Timeline** \- Visual execution flow
- **Span Details** \- Inputs, outputs, metadata
- **Performance Metrics** \- Latency, token usage
- **Team Collaboration** \- Share trace links

## Performance [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#performance)

CloudExporter uses intelligent batching to optimize network usage. Traces are buffered and sent in batches, reducing overhead while maintaining near real-time visibility.

### Batching Behavior [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#batching-behavior)

- Traces are batched up to `maxBatchSize` (default: 1000)
- Batches are sent when full or after `maxBatchWaitMs` (default: 5 seconds)
- Failed batches are retried with exponential backoff
- Graceful degradation if Mastra Cloud is unreachable

## Related [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud\#related)

- [AI Tracing Overview](https://mastra.ai/docs/observability/ai-tracing/overview)
- [DefaultExporter](https://mastra.ai/docs/observability/ai-tracing/exporters/default)
- [Mastra Cloud Documentation](https://cloud.mastra.ai/docs)

[Default](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default "Default") [Braintrust](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust "Braintrust")