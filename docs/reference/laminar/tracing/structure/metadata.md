---
title: Metadata - Laminar documentation
url:
description: Add contextual information to your traces
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/structure/metadata#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

⌘K

Search...

Navigation

Tracing Structure

Metadata

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [What is Trace Metadata?](https://docs.lmnr.ai/tracing/structure/metadata#what-is-trace-metadata%3F)
- [Adding Metadata to Traces](https://docs.lmnr.ai/tracing/structure/metadata#adding-metadata-to-traces)
- [Common Metadata Use Cases](https://docs.lmnr.ai/tracing/structure/metadata#common-metadata-use-cases)
- [Environment Information](https://docs.lmnr.ai/tracing/structure/metadata#environment-information)
- [Performance Tracking](https://docs.lmnr.ai/tracing/structure/metadata#performance-tracking)
- [A/B Testing](https://docs.lmnr.ai/tracing/structure/metadata#a%2Fb-testing)
- [Filtering Traces by Metadata](https://docs.lmnr.ai/tracing/structure/metadata#filtering-traces-by-metadata)
- [Metadata vs Tags](https://docs.lmnr.ai/tracing/structure/metadata#metadata-vs-tags)
- [Best Practices](https://docs.lmnr.ai/tracing/structure/metadata#best-practices)

## [​](https://docs.lmnr.ai/tracing/structure/metadata#what-is-trace-metadata%3F) What is Trace Metadata?

Metadata provides additional context to your traces beyond the basic trace information. It helps you:

- Filter and search for specific traces
- Add business context to technical traces
- Group related traces together
- Categorize traces by environment, feature, or user segment

Metadata is key-value information that is attached to an entire trace, as opposed to individual spans.

## [​](https://docs.lmnr.ai/tracing/structure/metadata#adding-metadata-to-traces) Adding Metadata to Traces

- JavaScript/TypeScript

- Python

Use the `Laminar.setTraceMetadata` inside a span context to add metadata to the trace:

Copy

```
import { Laminar, observe } from '@lmnr-ai/lmnr';

await observe(
  {
      name: 'processRequest',
  },
  async () => {
    Laminar.setTraceMetadata({
      environment: 'production',
      featureFlag: 'new-algorithm-v2',
      region: 'us-west'
    });
    // ...rest of your code here
  },
);

```

Alternatively, you can add metadata directly in the `observe` function:

Copy

```
import { observe } from '@lmnr-ai/lmnr';

await observe({
  name: 'processRequest',
  metadata: {
    environment: 'production',
    featureFlag: 'new-algorithm-v2'
  }
}, async () => {
  // Your code here
});

```

`Laminar.setTraceMetadata()` must be called within an active span context (such as within an `observe` function call). If called outside of any span context, it will have no effect.

❌ **Incorrect usage** (will not work):

Copy

```
// This won't work because it's outside any span context
Laminar.setTraceMetadata({ environment: 'production' });

await observe({ name: 'myFunction' }, async () => {
  // The metadata set above won't be applied here
});

```

✅ **Correct usage**:

Copy

```
await observe({ name: 'myFunction' }, async () => {
  // Set metadata inside the span context
  Laminar.setTraceMetadata({ environment: 'production' });
  // Your code here
});

```

Any new call to set metadata will overwrite the previous metadata.

- JavaScript/TypeScript

- Python

❌ **Incorrect usage**:

Copy

```
await observe({ name: 'myFunction' }, async () => {
  Laminar.setTraceMetadata({ environment: 'production' });
  // This will overwrite the previous metadata including the environment
  Laminar.setTraceMetadata({ region: 'us-west' });
});

```

✅ **Correct usage**:

Copy

```
await observe({ name: 'myFunction' }, async () => {
  Laminar.setTraceMetadata({
    environment: 'production',
    region: 'us-west'
  });
});

```

## [​](https://docs.lmnr.ai/tracing/structure/metadata#common-metadata-use-cases) Common Metadata Use Cases

### [​](https://docs.lmnr.ai/tracing/structure/metadata#environment-information) Environment Information

- JavaScript/TypeScript

- Python

Copy

```
Laminar.setTraceMetadata({
    environment: 'production', // or 'staging', 'development', etc.
    region: 'us-west',
    deploymentId: 'deploy-123'
});

```

### [​](https://docs.lmnr.ai/tracing/structure/metadata#performance-tracking) Performance Tracking

- JavaScript/TypeScript

- Python

Copy

```
Laminar.setTraceMetadata({
    batchSize: 128,
    optimizerVersion: 'v2',
    modelVariant: 'high-performance'
});

```

### [​](https://docs.lmnr.ai/tracing/structure/metadata#a%2Fb-testing) A/B Testing

- JavaScript/TypeScript

- Python

Copy

```
Laminar.setTraceMetadata({
    experimentId: 'exp-456',
    variant: 'treatment-B',
    cohort: 'new-users'
});

```

## [​](https://docs.lmnr.ai/tracing/structure/metadata#filtering-traces-by-metadata) Filtering Traces by Metadata

You can filter traces by metadata in the Laminar UI. Currently, we only support exact key-value matches,
e.g. a trace with

Copy

```
{
    "metadata": {
        "userId": "123",
        "region": "us-west"
    }
}

```

can be matched by searching for `userId=123` or `region=us-west`.

1. Go to the Traces/Spans page
2. Add a metadata filter and fill in the key and value

In the example below, we filter by `userId` key of the metadata:![Filter by metadata](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/metadata-filter.png?w=2500&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=967f9dcc9aa45f128ce9ad92ae3237c2)

## [​](https://docs.lmnr.ai/tracing/structure/metadata#metadata-vs-tags) Metadata vs Tags

Adding metadata to a trace is different from adding tags to a span:

|                 | Metadata                       | Tags                             |
| --------------- | ------------------------------ | -------------------------------- |
| **Scope**       | Applies to entire trace        | Applies to individual spans      |
| **Purpose**     | General trace context          | Specific span classification     |
| **Validation**  | Any string key-value pairs     | Any string                       |
| **UI Location** | Shown in trace overview        | Shown in individual span details |
| **Common Uses** | Environment info, user context | Data categories, tags            |

To learn more about tags, see [tags](https://docs.lmnr.ai/tracing/structure/tags).

## [​](https://docs.lmnr.ai/tracing/structure/metadata#best-practices) Best Practices

1. **Consistent Keys**: Use consistent key names across your application
2. **Avoid Sensitive Data**: Don’t include PII or sensitive data in metadata
3. **Keep It Lightweight**: Only include metadata that adds meaningful context
4. **Standardize Values**: Use consistent formats and enumerations for values

[User ID](https://docs.lmnr.ai/tracing/structure/user-id) [Tags](https://docs.lmnr.ai/tracing/structure/tags)

⌘I

Assistant

Responses are generated using AI and may contain mistakes.
