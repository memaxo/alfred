---
title: Track and associate traces with specific users - Laminar documentation
url: 
description: Track and associate traces with specific users
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/structure/user-id#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Track and associate traces with specific users

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Associating Traces with Users](https://docs.lmnr.ai/tracing/structure/user-id#associating-traces-with-users)
- [Setting User ID](https://docs.lmnr.ai/tracing/structure/user-id#setting-user-id)
- [Privacy Considerations](https://docs.lmnr.ai/tracing/structure/user-id#privacy-considerations)

## [​](https://docs.lmnr.ai/tracing/structure/user-id\#associating-traces-with-users)  Associating Traces with Users

Tracking which user triggered a particular trace is crucial for:

- User-specific debugging
- Analyzing usage patterns
- Filtering traces in the dashboard
- Compliance with data regulations

In Laminar, you can associate traces with users by setting user ID on a trace.

## [​](https://docs.lmnr.ai/tracing/structure/user-id\#setting-user-id)  Setting User ID

This allows you to filter and search for traces by user ID later.

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar, observe } from '@lmnr-ai/lmnr';

// Option 1. directly pass userId to observe
await observe({
    name: 'processUserRequest',
    userId: 'user_123'
}, async () => {
    // Process user request here
});

// Option 2.Use Laminar.setTraceUserId
await observe({
    name: 'processUserRequest',
}, async () => {
    Laminar.setTraceUserId('user_123');
    // Process user request here
});

```

## [​](https://docs.lmnr.ai/tracing/structure/user-id\#privacy-considerations)  Privacy Considerations

When including user IDs in traces, consider the following privacy practices:

- Use anonymous or pseudonymous IDs rather than personally identifiable information
- Consider your data retention policies
- Use Laminar’s [tracing level](https://docs.lmnr.ai/tracing/structure/tracing-level) settings to control sensitive data
- Follow relevant data protection regulations

- JavaScript/TypeScript

- Python


Copy

```
// Use TracingLevel.META_ONLY for sensitive user operations
import { withTracingLevel, TracingLevel } from "@lmnr-ai/lmnr";

withTracingLevel(TracingLevel.META_ONLY, () => {
    // Sensitive operations here will only record metadata
    // Input/output content won't be saved
});

```

[Sessions](https://docs.lmnr.ai/tracing/structure/session) [Metadata](https://docs.lmnr.ai/tracing/structure/metadata)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.