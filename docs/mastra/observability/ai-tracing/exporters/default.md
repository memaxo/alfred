---
title: Default Exporter | AI Tracing | Observability | Mastra Docs
url: 
description: Store traces locally for development and debugging
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") [AI Tracing](https://mastra.ai/en/docs/observability/ai-tracing/overview "AI Tracing") ExportersDefault

Copy page

# Default Exporter

The `DefaultExporter` persists traces to your configured storage backend, making them accessible through the Mastra Playground. It’s automatically enabled when using the default observability configuration and requires no external services.

## When to Use DefaultExporter [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#when-to-use-defaultexporter)

DefaultExporter is ideal for:

- **Local development** \- Debug and analyze traces offline
- **Data ownership** \- Complete control over your trace data
- **Zero dependencies** \- No external services required
- **Playground integration** \- View traces in Mastra Playground UI

## Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#configuration)

### Prerequisites [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#prerequisites)

1. **Storage Backend**: Configure a storage provider (LibSQL, PostgreSQL, etc.)
2. **Mastra Playground**: Install for viewing traces locally

### Basic Setup [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#basic-setup)

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { DefaultExporter } from "@mastra/core/ai-tracing";
import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: "file:./mastra.db",  // Required for trace persistence
  }),
  observability: {
    configs: {
      local: {
        serviceName: 'my-service',
        exporters: [\
          new DefaultExporter(),\
        ],
      },
    },
  },
});
```

### Automatic Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#automatic-configuration)

When using the default observability configuration, DefaultExporter is automatically included:

```nextra-code

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
  observability: {
    default: { enabled: true },  // Automatically includes DefaultExporter
  },
});
```

## Viewing Traces [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#viewing-traces)

### Mastra Playground [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#mastra-playground)

Access your traces through the local Playground:

1. Start the Playground
2. Navigate to Observability
3. Filter and search your local traces
4. Inspect detailed span information

## Tracing Strategies [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#tracing-strategies)

DefaultExporter automatically selects the optimal tracing strategy based on your storage provider. You can also override this selection if needed.

### Available Strategies [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#available-strategies)

| Strategy | Description | Use Case |
| --- | --- | --- |
| **realtime** | Process each event immediately | Development, debugging, low traffic |
| **batch-with-updates** | Buffer events and batch write with full lifecycle support | Low volume Production |
| **insert-only** | Only process completed spans, ignore updates | High volume Production |

### Strategy Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#strategy-configuration)

```nextra-code

new DefaultExporter({
  strategy: 'auto',  // Default - let storage provider decide
  // or explicitly set:
  // strategy: 'realtime' | 'batch-with-updates' | 'insert-only'

  // Batching configuration (applies to both batch-with-updates and insert-only)
  maxBatchSize: 1000,      // Max spans per batch
  maxBatchWaitMs: 5000,    // Max wait before flushing
  maxBufferSize: 10000,    // Max spans to buffer
})
```

## Storage Provider Support [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#storage-provider-support)

Different storage providers support different tracing strategies.

If you set the strategy to `'auto'`, the `DefaultExporter` automatically selects the optimal strategy for the storage provider. If you set the strategy to a mode that the storage provider doesn’t support, you will get an error message.

| Storage Provider | Preferred Strategy | Supported Strategies | Notes |
| --- | --- | --- | --- |
| **[LibSQL](https://mastra.ai/reference/storage/libsql)** | batch-with-updates | realtime, batch-with-updates, insert-only | Default storage, good for development |
| **[PostgreSQL](https://mastra.ai/reference/storage/postgresql)** | batch-with-updates | batch-with-updates, insert-only | Recommended for production |

### Strategy Benefits [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#strategy-benefits)

- **realtime**: Immediate visibility, best for debugging
- **batch-with-updates**: 10-100x throughput improvement, full span lifecycle
- **insert-only**: Additional 70% reduction in database operations, perfect for analytics

## Batching Behavior [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#batching-behavior)

### Flush Triggers [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#flush-triggers)

For both batch strategies ( `batch-with-updates` and `insert-only`), traces are flushed to storage when any of these conditions are met:

1. **Size trigger**: Buffer reaches `maxBatchSize` spans
2. **Time trigger**: `maxBatchWaitMs` elapsed since first event
3. **Emergency flush**: Buffer approaches `maxBufferSize` limit
4. **Shutdown**: Force flush all pending events

### Error Handling [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#error-handling)

The DefaultExporter includes robust error handling for production use:

- **Retry Logic**: Exponential backoff (500ms, 1s, 2s, 4s)
- **Transient Failures**: Automatic retry with backoff
- **Persistent Failures**: Drop batch after 4 failed attempts
- **Buffer Overflow**: Prevent memory issues during storage outages

### Configuration Examples [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#configuration-examples)

```nextra-code

// Zero config - recommended for most users
new DefaultExporter()

// Development override
new DefaultExporter({
  strategy: 'realtime',  // Immediate visibility for debugging
})

// High-throughput production
new DefaultExporter({
  maxBatchSize: 2000,      // Larger batches
  maxBatchWaitMs: 10000,   // Wait longer to fill batches
  maxBufferSize: 50000,    // Handle longer outages
})

// Low-latency production
new DefaultExporter({
  maxBatchSize: 100,       // Smaller batches
  maxBatchWaitMs: 1000,    // Flush quickly
})
```

## Related [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default\#related)

- [AI Tracing Overview](https://mastra.ai/docs/observability/ai-tracing/overview)
- [CloudExporter](https://mastra.ai/docs/observability/ai-tracing/exporters/cloud)
- [Storage Configuration](https://mastra.ai/docs/storage/overview)

[Overview](https://mastra.ai/en/docs/observability/ai-tracing/overview "Overview") [Cloud](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud "Cloud")