---
title: Tracing structure - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/structure/overview#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Tracing structure

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/structure/overview#overview)
- [Why Structure Matters](https://docs.lmnr.ai/tracing/structure/overview#why-structure-matters)
- [Quickstart](https://docs.lmnr.ai/tracing/structure/overview#quickstart)

## [​](https://docs.lmnr.ai/tracing/structure/overview\#overview)  Overview

Effective trace structuring enhances the value of your tracing data, making it easier to debug, analyze, and optimize your LLM applications. This section covers the essential components of trace structuring in Laminar:

| Component | Description |
| --- | --- |
| [Observe](https://docs.lmnr.ai/tracing/structure/observe) | Create a span with `observe` function decorator or wrapper |
| [Manual span creation](https://docs.lmnr.ai/tracing/structure/manual-span-creation) | Create a span manually within a function |
| [Sessions](https://docs.lmnr.ai/tracing/structure/session) | Group related traces together for better organization |
| [User ID](https://docs.lmnr.ai/tracing/structure/user-id) | Associate traces with specific users for targeted analysis |
| [Metadata](https://docs.lmnr.ai/tracing/structure/metadata) | Add contextual information to your traces for filtering and grouping |

## [​](https://docs.lmnr.ai/tracing/structure/overview\#why-structure-matters)  Why Structure Matters

Without structure, each LLM call creates an isolated trace, making it difficult to:

- Understand the relationships between different LLM calls
- Track user journeys through your application
- Debug complex multi-step workflows
- Find relevant traces quickly

Properly structured traces provide a clear picture of your application’s flow, making it easier to identify bottlenecks, debug issues, and optimize performance.

## [​](https://docs.lmnr.ai/tracing/structure/overview\#quickstart)  Quickstart

Start by implementing the `observe` wrapper or decorator to create parent spans that group your LLM calls into meaningful traces. Then, enhance these traces with session id, user id, and metadata to create a comprehensive tracing structure.

- JavaScript/TypeScript

- Python


Copy

```
// Example: A well-structured trace implementation
import { Laminar, observe } from '@lmnr-ai/lmnr';

// Initialize with your project key
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

// Create a parent span for the entire request
await observe({ name: 'processUserRequest' }, async (userId, requestId) => {
  // Your LLM calls and other operations will be children
  // of this 'processUserRequest' span
  // and inherit the session id, user id, and metadata

  Laminar.setTraceUserId(userId);

  Laminar.setTraceSessionId(`session-${requestId}`);

  Laminar.setTraceMetadata({
    environment: process.env.NODE_ENV
  });

  // ... you LLM calls here ...
});

```

Explore each component in detail through the links above to implement a comprehensive tracing structure for your LLM applications.

[Skyvern](https://docs.lmnr.ai/tracing/integrations/skyvern) [Observe Decorator/Wrapper](https://docs.lmnr.ai/tracing/structure/observe)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.