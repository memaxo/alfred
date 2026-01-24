---
title: Continuing Traces - Laminar documentation
url:
description: Techniques for continuing traces across function boundaries and services
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/structure/continuing-traces#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Continuing Traces

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/structure/continuing-traces#overview)
- [Passing Span Objects](https://docs.lmnr.ai/tracing/structure/continuing-traces#passing-span-objects)
- [Using Span Context Serialization](https://docs.lmnr.ai/tracing/structure/continuing-traces#using-span-context-serialization)
- [LaminarSpanContext](https://docs.lmnr.ai/tracing/structure/continuing-traces#laminarspancontext)
- [Passing Context via HTTP Headers](https://docs.lmnr.ai/tracing/structure/continuing-traces#passing-context-via-http-headers)
- [Common Patterns](https://docs.lmnr.ai/tracing/structure/continuing-traces#common-patterns)
- [Database Storage Pattern](https://docs.lmnr.ai/tracing/structure/continuing-traces#database-storage-pattern)
- [Message Queue Pattern](https://docs.lmnr.ai/tracing/structure/continuing-traces#message-queue-pattern)
- [Best Practices](https://docs.lmnr.ai/tracing/structure/continuing-traces#best-practices)
- [Context Validation](https://docs.lmnr.ai/tracing/structure/continuing-traces#context-validation)

## [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#overview) Overview

When building complex applications, you often need to continue traces across different parts of your system:

- **Function boundaries** where traces need to span multiple function calls
- **Service boundaries** where traces cross different microservices
- **Async operations** where traces need to be maintained across async boundaries
- **Request handlers** where different API endpoints handle parts of the same user journey

## [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#passing-span-objects) Passing Span Objects

The most direct way to continue traces is by passing span objects between functions.

- JavaScript/TypeScript

- Python

Use `Laminar.startSpan()` and `Laminar.withSpan()` to create and continue spans:

Copy

```
import { Laminar, observe, Span } from '@lmnr-ai/lmnr';

const processData = (span: Span, data: any) => {
  return Laminar.withSpan(span, async () => {
    // This code runs within the provided span context
    await observe({ name: 'dataValidation' }, async () => {
      // Child span - will be nested under the passed span
      return validateData(data);
    });
  });
};

const generateResponse = async (span: Span, processedData: any) => {
  await Laminar.withSpan(span, async () => {
    await observe({ name: 'responseGeneration' }, async () => {
      // Another child span under the same parent
      return await generateLLMResponse(processedData);
    });
  });
};

// Main orchestrator
const handleRequest = async (userInput: string) => {
  const rootSpan = Laminar.startSpan('handleUserRequest');

  try {
    const processedData = await processData(rootSpan, userInput);
    const response = await generateResponse(rootSpan, processedData);
    return response;
  } finally {
    // Always end the span!
    rootSpan.end();
  }
};

```

Remember to call `span.end()` to complete the trace. You can also pass `true` as the third argument ( `endOnExit`) to the last `Laminar.withSpan()` call to automatically end the span.

## [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#using-span-context-serialization) Using Span Context Serialization

When you can’t pass span objects directly (e.g., across service boundaries or through message queues), use span context serialization.

### [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#laminarspancontext) LaminarSpanContext

LaminarSpanContext allows you to serialize and deserialize span context as strings, making it possible to continue traces across services.

- JavaScript/TypeScript

- Python

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';

// Serialize span context to string (e.g., in first service)
let spanContext: string | null = null;

const firstHandler = async () => {
    const span = Laminar.startSpan({ name: 'firstHandler' });

    // Serialize the span context
    spanContext = Laminar.serializeLaminarSpanContext(span);

    // Store spanContext in database, send via HTTP header, etc.

    span.end();
};

// Deserialize and continue trace (e.g., in second service)
const secondHandler = async () => {
    const span = Laminar.startSpan({
        name: 'secondHandler',
        parentSpanContext: spanContext ?? undefined,
    });

    // This span will be a child of the first handler's span
    // Your code here...

    span.end();
};

```

### [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#passing-context-via-http-headers) Passing Context via HTTP Headers

Copy

```
// Service A - serialize and send
const response = await fetch('/api/service-b', {
  headers: {
    'x-laminar-span-context': Laminar.serializeLaminarSpanContext()
  }
});

// Service B - deserialize and continue
app.post('/api/service-b', (req, res) => {
  const spanContext = req.headers['x-laminar-span-context'];

  const span = Laminar.startSpan({
    name: 'serviceBHandler',
    parentSpanContext: spanContext
  });

  // Handle request...
  span.end();
});

```

## [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#common-patterns) Common Patterns

### [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#database-storage-pattern) Database Storage Pattern

For long-running workflows where traces span multiple user sessions:

Copy

```
# Store trace context with workflow state
def start_workflow(user_id: str, workflow_data: dict):
    with Laminar.start_as_current_span(name="workflow_start") as span:
        span_context = Laminar.serialize_span_context(span)

        # Store in database with workflow
        db.save_workflow({
            'user_id': user_id,
            'span_context': span_context,
            'data': workflow_data,
            'status': 'started'
        })

# Continue trace when workflow resumes
def continue_workflow(workflow_id: str):
    workflow = db.get_workflow(workflow_id)
    parent_context = Laminar.deserialize_span_context(workflow['span_context'])

    with Laminar.start_as_current_span(
        name="workflow_continue",
        parent_span_context=parent_context
    ):
        # Continue processing...
        pass

```

### [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#message-queue-pattern) Message Queue Pattern

For async processing across services:

Copy

```
# Producer - send with trace context
def enqueue_task(task_data: dict):
    with Laminar.start_as_current_span(name="task_enqueued"):
        span_context = Laminar.serialize_span_context()

        message = {
            'data': task_data,
            'trace_context': span_context
        }
        queue.send(message)

# Consumer - continue trace
def process_task(message: dict):
    parent_context = Laminar.deserialize_span_context(
        message.get('trace_context')
    )

    with Laminar.start_as_current_span(
        name="task_processed",
        parent_span_context=parent_context
    ):
        # Process the task...
        pass

```

## [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#best-practices) Best Practices

### [​](https://docs.lmnr.ai/tracing/structure/continuing-traces#context-validation) Context Validation

Always validate span context before using it:

Copy

```
def safe_deserialize_context(context_str: str):
    try:
        return Laminar.deserialize_span_context(context_str) if context_str else None
    except Exception as e:
        # Log error and continue without parent context
        logger.warning(f"Failed to deserialize span context: {e}")
        return None

```

Trace continuation enables you to maintain observability across complex, distributed systems while preserving the logical flow of operations.

[Image Tracing](https://docs.lmnr.ai/tracing/structure/image) [LLM cost tracking](https://docs.lmnr.ai/tracing/structure/providers)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
