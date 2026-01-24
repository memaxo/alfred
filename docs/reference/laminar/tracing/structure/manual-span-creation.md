---
title: Manual Span Creation - Laminar documentation
url:
description: Creating and managing spans manually for fine-grained control
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/structure/manual-span-creation#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Manual Span Creation

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/structure/manual-span-creation#overview)
- [Basic Usage](https://docs.lmnr.ai/tracing/structure/manual-span-creation#basic-usage)
- [Parameters](https://docs.lmnr.ai/tracing/structure/manual-span-creation#parameters)
- [Manually creating an LLM span](https://docs.lmnr.ai/tracing/structure/manual-span-creation#manually-creating-an-llm-span)
- [Fine-grained control over span creation](https://docs.lmnr.ai/tracing/structure/manual-span-creation#fine-grained-control-over-span-creation)
- [Custom Span Hierarchies](https://docs.lmnr.ai/tracing/structure/manual-span-creation#custom-span-hierarchies)
- [Capturing errors and setting span attributes](https://docs.lmnr.ai/tracing/structure/manual-span-creation#capturing-errors-and-setting-span-attributes)
- [Best Practices](https://docs.lmnr.ai/tracing/structure/manual-span-creation#best-practices)
- [Always End Spans](https://docs.lmnr.ai/tracing/structure/manual-span-creation#always-end-spans)
- [Meaningful Span Names](https://docs.lmnr.ai/tracing/structure/manual-span-creation#meaningful-span-names)
- [Rich Attributes](https://docs.lmnr.ai/tracing/structure/manual-span-creation#rich-attributes)

## [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#overview) Overview

Manual span creation gives you fine-grained control over span lifecycle, attributes, and hierarchies. This is useful for:

- **Fine-grained control** over span lifecycle and attributes
- **Integration with existing tracing** in codebases that already use OpenTelemetry
- **Custom span hierarchies** that don’t fit the function-level `observe` pattern

- Python

The `Laminar.start_as_current_span` method is a recommended way to create spans manually in Python.
It creates a new span and sets it as the current span using a context manager. Context manager properly starts and ends the span.

### [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#basic-usage) Basic Usage

Copy

```
from lmnr import Laminar

def process_data(input_data):
  # ... your code here ...

    with Laminar.start_as_current_span(
        name="custom_operation", # name of the span
        input=input_data, # input of the span
        span_type="DEFAULT" # type of the span. If not specified, it will be `'DEFAULT'`
    ) as span:
        try:
            # ... your code here ...
            result = process_data(input_data)

            # Set span output and custom attributes
            Laminar.set_span_output(result)
            Laminar.set_span_attributes({
                "custom.result_count": len(result)
            })

        except Exception as error:
            # Record error on span
            span.record_exception(error) # This will create exception event on the span
            raise

```

### [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#parameters) Parameters

- `name` ( `str`): name of the span
- `input` ( `Any`): input to the span. It will be serialized to JSON and recorded as span input
- `span_type` ( `Literal['DEFAULT'] | Literal['LLM']`): type of the span. If not specified, it will be `'DEFAULT'`

### [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#manually-creating-an-llm-span) Manually creating an LLM span

To manually create an LLM span, set `span_type="LLM"` and properly set the span attributes related to LLM calls.

It’s highly recommended to set input of manual LLM spans in the OpenAI’s `messages` format to get see LLM calls-specific rendering in the UI.

- JavaScript/TypeScript

- Python

Copy

```
import { Laminar, LaminarAttributes } from '@lmnr-ai/lmnr';

const span = Laminar.startSpan({ name: 'custom_llm_call', span_type: 'LLM' });

const response = await fetch('https://api.custom-llm.com/v1/completions', {
  method: 'POST',
  body: JSON.stringify({
    model: 'custom-model-1',
    messages: [{ role: 'user', content: 'What is the longest river in the world?' }],
  }),
});

const data = await response.json();

span.setAttributes({
  [LaminarAttributes.PROVIDER]: 'custom-llm.com',
  [LaminarAttributes.REQUEST_MODEL]: 'custom-model-1',
  [LaminarAttributes.RESPONSE_MODEL]: data.model,
  [LaminarAttributes.INPUT_TOKEN_COUNT]: data.usage.input_tokens,
  [LaminarAttributes.OUTPUT_TOKEN_COUNT]: data.usage.output_tokens,
});

span.end();

```

## [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#fine-grained-control-over-span-creation) Fine-grained control over span creation

If you need absolute control over span creation and completion, Laminar provides methods to start and end spans manually.

- JavaScript/TypeScript

- Python

You can use `Laminar.startSpan` to create a span manually.
It doesn’t set the span as the current span.
You need to manually set the span as the current span using `Laminar.withSpan` context manager.
You also need to manually end the span using `span.end()` method.

You can use `Laminar.withSpan` to set the manually created span as the current span.

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';

const span = Laminar.startSpan({ name: 'operation' });

try {
  // ... your code here ...
  const result = await performOperation(); // defined somewhere else

  Laminar.withSpan(span, async () => {

    await observe({ name: 'nested_operation' }, async () => {
      // now `nested_operation` will be a child of `operation` span
    });

  });

  span.setAttributes({
    'operation.result_count': result.length,
    'operation.success': true
  });

} finally {
  // Always end the span
  span.end();
}

```

## [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#custom-span-hierarchies) Custom Span Hierarchies

Example of creating complex span hierarchies for detailed tracing of multi-step operations:

- JavaScript/TypeScript

- Python

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';

const processWorkflow = async (workflowData) => {
  const workflowSpan = Laminar.startSpan({
    name: 'workflow-execution',
    metadata: { workflowId: workflowData.id }
  });

  try {
    await Laminar.withSpan(workflowSpan, async () => {
      // Step 1: Validation
      const validationSpan = Laminar.startSpan({ name: 'validation' });
      await Laminar.withSpan(validationSpan, async () => {
        await validateWorkflow(workflowData);
      });
      validationSpan.end();

      // Step 2: Processing
      const processingSpan = Laminar.startSpan({ name: 'processing' });
      await Laminar.withSpan(processingSpan, async () => {
        const result = await processWithLLM(workflowData);

        processingSpan.setAttributes({
          'processing.items_count': result.items.length,
          'processing.duration_ms': result.duration
        });
      });
      processingSpan.end();

      // Step 3: Finalization
      const finalizationSpan = Laminar.startSpan({ name: 'finalization' });
      await Laminar.withSpan(finalizationSpan, async () => {
        await finalizeWorkflow(workflowData);
      });
      finalizationSpan.end();
    });

    workflowSpan.setAttributes({
      'workflow.status': 'completed',
      'workflow.total_steps': 3
    });

  } catch (error) {
    workflowSpan.recordException(error);
    throw error;
  } finally {
    workflowSpan.end();
  }
};

```

## [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#capturing-errors-and-setting-span-attributes) Capturing errors and setting span attributes

To properly handle errors and set span attributes for better observability, you can use the following pattern.

- JavaScript/TypeScript

- Python

Copy

```
const span = Laminar.startSpan({ name: 'risky-operation' });

try {
  const result = await riskyOperation();

  span.setAttributes({ 'operation.result': 'success' });

} catch (error) {
  // Record the exception details
  span.recordException(error);

  throw error; // Re-throw if needed
} finally {
  span.end();
}

```

## [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#best-practices) Best Practices

### [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#always-end-spans) Always End Spans

Copy

```
# ✅ Good - using context manager (automatic cleanup)
with Laminar.start_as_current_span(name="operation"):
    do_work()

# ✅ Good - manual cleanup with try/finally
span = Laminar.start_span(name="operation")
try:
    do_work()
finally:
    span.end()

# ❌ Bad - no cleanup (span never ends)
span = Laminar.start_span(name="operation")
do_work()

```

### [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#meaningful-span-names) Meaningful Span Names

Copy

```
# ✅ Good - descriptive, hierarchical names
with Laminar.start_as_current_span(name="user_registration.email_validation"):
    validate_email()

with Laminar.start_as_current_span(name="user_registration.password_hashing"):
    hash_password()

# ❌ Bad - generic or unclear names
with Laminar.start_as_current_span(name="process"):
    validate_email()

```

### [​](https://docs.lmnr.ai/tracing/structure/manual-span-creation#rich-attributes) Rich Attributes

Copy

```
# ✅ Good - structured, queryable attributes
Laminar.set_span_attributes({
    "user.id": user_id,
    "user.tier": "premium",
    "operation.batch_size": 100,
    "operation.retry_count": 2,
    "feature.experimental_enabled": True
})

# ❌ Bad - unstructured or missing context
Laminar.set_span_attributes({
    "data": "some processing"
})

```

Manual span creation provides the flexibility and control needed for complex tracing scenarios while maintaining compatibility with the broader OpenTelemetry ecosystem.

[Observe Decorator/Wrapper](https://docs.lmnr.ai/tracing/structure/observe) [Sessions](https://docs.lmnr.ai/tracing/structure/session)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
