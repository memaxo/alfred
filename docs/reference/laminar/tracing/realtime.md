---
title: Monitor and debug traces in real-time as they're being executed - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/realtime#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

Monitor and debug traces in real-time as they're being executed

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/realtime#overview)
- [How It Works](https://docs.lmnr.ai/tracing/realtime#how-it-works)
- [Disable Batching (Optional)](https://docs.lmnr.ai/tracing/realtime#disable-batching-optional)
- [Performance Considerations](https://docs.lmnr.ai/tracing/realtime#performance-considerations)
- [Benefits](https://docs.lmnr.ai/tracing/realtime#benefits)

## [​](https://docs.lmnr.ai/tracing/realtime#overview) Overview

Real-time traces are one of Laminar’s most powerful features, allowing you to see spans as they’re being executed without waiting for the top-level span to complete. This provides immediate visibility into trace data during development and debugging processes, which is especially valuable when:

- Working with long-running operations
- Debugging complex agent interactions
- Monitoring multiple chained LLM requests
- Testing a system in development

![Realtime traces](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/realtime/realtime.gif?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=88de0babf6d1cbadbc882b06c08bc63f)

## [​](https://docs.lmnr.ai/tracing/realtime#how-it-works) How It Works

Laminar uses [OpenTelemetry](https://opentelemetry.io/) for trace collection and processing. By default, it uses `BatchSpanProcessor`, which buffers and sends traces in batches to optimize performance:

- Traces are collected and stored temporarily on the client side
- Data is sent periodically to the Laminar backend
- There’s a small delay between span completion and dashboard visibility
- The delay depends on batch configuration (flush interval and batch size)

Real-time traces are currently available only in the Laminar cloud platform.

## [​](https://docs.lmnr.ai/tracing/realtime#disable-batching-optional) Disable Batching (Optional)

For immediate trace visibility, you can disable batching by setting `disableBatch` to `true` in the `Laminar.initialize` function:

- JavaScript/Typescript

- Python

Copy

```
Laminar.initialize({
    // ... other options
    disableBatch: true,
});

```

This configuration uses `SimpleSpanProcessor`, which processes and sends traces immediately.

### [​](https://docs.lmnr.ai/tracing/realtime#performance-considerations) Performance Considerations

- **Development**: Real-time processing provides immediate feedback, beneficial for debugging and development workflows
- **Production**: Batch processing is recommended for better performance and resource utilization

While real-time traces provide immediate visibility, disabling batching may impact application performance in production environments.

## [​](https://docs.lmnr.ai/tracing/realtime#benefits) Benefits

1. **Immediate Feedback**: See traces as they happen, without waiting for operations to complete
2. **Faster Debugging**: Identify issues in real-time without waiting for batched processing
3. **Progress Monitoring**: Track long-running operations as they execute
4. **Enhanced Development Experience**: Test and iterate more quickly with instant visibility

[LLM cost tracking](https://docs.lmnr.ai/tracing/structure/providers) [Browser agent observability](https://docs.lmnr.ai/tracing/browser-agent-observability)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
