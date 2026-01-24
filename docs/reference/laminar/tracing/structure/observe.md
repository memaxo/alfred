---
title: Observe Decorator/Wrapper - Laminar documentation
url:
description: Using the observe decorator/wrapper to structure your traces
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/structure/observe#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Observe Decorator/Wrapper

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/structure/observe#overview)
- [Basic Usage](https://docs.lmnr.ai/tracing/structure/observe#basic-usage)
- [Detailed Reference](https://docs.lmnr.ai/tracing/structure/observe#detailed-reference)
- [General syntax](https://docs.lmnr.ai/tracing/structure/observe#general-syntax)
- [Parameters (ObserveOptions)](https://docs.lmnr.ai/tracing/structure/observe#parameters-observeoptions)
- [Inputs and outputs](https://docs.lmnr.ai/tracing/structure/observe#inputs-and-outputs)
- [Use Cases](https://docs.lmnr.ai/tracing/structure/observe#use-cases)
- [Grouping LLM Calls](https://docs.lmnr.ai/tracing/structure/observe#grouping-llm-calls)
- [Alternative Methods](https://docs.lmnr.ai/tracing/structure/observe#alternative-methods)

## [​](https://docs.lmnr.ai/tracing/structure/observe#overview) Overview

The `observe` decorator (Python) or function wrapper (JavaScript/TypeScript) is the simplest way to structure your traces in Laminar. It allows you to:

- Create a parent span that groups multiple LLM calls into a single trace
- Capture inputs and outputs of your functions automatically
- Structure your application’s tracing in a logical way

## [​](https://docs.lmnr.ai/tracing/structure/observe#basic-usage) Basic Usage

- JavaScript/TypeScript

- Python

You can instrument specific functions by wrapping them in `observe()`.
This is especially helpful when you want to trace functions, or group
separate functions into a single trace.

Copy

```
import { observe } from '@lmnr-ai/lmnr';

const myFunction = async () => observe(
  { name: 'myFunction'},
  async () => {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What is the capital of France?" }],
    });
    return response.choices[0].message.content;
  }
);

await myFunction();

```

We are now recording `my_function` _and_ the OpenAI call, which is nested inside it, in the same trace. Notice that the OpenAI span is a child of `my_function`. Parent-child relationships are automatically detected and visualized with tree hierarchy.

![OpenAI span as a child](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-observe.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=f54ccbac5b36b211001251b4239ed861)

You can nest as many spans as you want inside each other. By observing both the functions and the LLM/vector DB calls
you can have better visualization of execution flow which is useful for debugging and better understanding of the application.

Input arguments to the function are automatically recorded as inputs of the span. The return value is automatically recorded as the output of the span.Passing arguments to the function in TypeScript is slightly non-obvious. Example:

Copy

```
const myFunction = async () => observe(
  { name: 'myFunction' },
  async (param1, param2) => {
    // ...
  }
  'argValue1',
  'argValue2'
);

```

## [​](https://docs.lmnr.ai/tracing/structure/observe#detailed-reference) Detailed Reference

- JavaScript/TypeScript

- Python

### [​](https://docs.lmnr.ai/tracing/structure/observe#general-syntax) General syntax

Copy

```
await observe({ ...options }, async (param1, param2) => {
  // your code here
}, arg1, arg2);

```

### [​](https://docs.lmnr.ai/tracing/structure/observe#parameters-observeoptions) Parameters ( `ObserveOptions`)

- `name` ( `string`): name of the span. If not passed, and the function to observe is not an anonymous arrow function, the function name will be used.
- `sessionId` ( `string`): session ID for the wrapped trace.
- `userId` ( `string`): user ID for the wrapped trace.
- `metadata` ( `Record<string, any>`): metadata for the wrapped trace, must be json serializable.
- `traceType` ( `'DEFAULT'|'EVALUATION'`): Type of the trace. Unless it is within evaluation, it must be `'DEFAULT'`.
- `spanType` ( `'DEFAULT'|'LLM'`) \- Type of the span. `'DEFAULT'` is used if not specified. If the type is `'LLM'`,
  you must manually specify some attributes. This translates to `lmnr.span.type` attribute on the span.
- `traceId` ( `string`): \[experimental\] trace ID for the current trace. This is useful if you want to continue an existing trace.
  IMPORTANT: must be a valid UUID, i.e. has to include 8-4-4-4-12 hex digits.
- `input`: a dictionary of input parameters. Is preferred over function parameters.
- `ignoreInput` ( `boolean`): if `true`, the input will not be recorded.
- `ignoreOutput` ( `boolean`): if `true`, the output will not be recorded.
- `tags` ( `string[]`): array of tags to add to the span.

### [​](https://docs.lmnr.ai/tracing/structure/observe#inputs-and-outputs) Inputs and outputs

- Function parameters and their values are serialized to JSON and recorded as span input.
- Function return value is serialized to JSON and recorded as span output.

For example:

Copy

```
const result = await observe({ name: 'my_span' }, async (param1, param2) => {
    return param1 + param2;
}, 1, 2);

```

In this case, the span will have the following attributes:

- Span input ( `lmnr.span.input`) will be `{"param1": 1, "param2": 2}`
- Span output ( `lmnr.span.output`) will be `3`

## [​](https://docs.lmnr.ai/tracing/structure/observe#use-cases) Use Cases

### [​](https://docs.lmnr.ai/tracing/structure/observe#grouping-llm-calls) Grouping LLM Calls

One of the most common use cases for `observe` is to group multiple LLM calls into a single trace:

- JavaScript/TypeScript

- Python

Copy

```
import { Laminar, observe } from '@lmnr-ai/lmnr';
import { OpenAI } from 'openai';

const handle = async (userMessage) =>
    await observe({name: 'requestHandler'}, async () => {
        // First LLM call
        const routerResponse = await openai.chat.completions.create({
            messages: [\
                {role: 'user', content: 'First prompt' + userMessage}\
            ],
            model: 'gpt-4o-mini',
        });

        // Second LLM call
        const modelResponse = await openai.chat.completions.create({
            messages: [\
                {role: 'user', content: userMessage}\
            ],
            model: 'gpt-4o',
        });

        return modelResponse.choices[0].message.content;
    });

```

## [​](https://docs.lmnr.ai/tracing/structure/observe#alternative-methods) Alternative Methods

In Python, you can also use `Laminar.start_as_current_span` if you want to trace a specific block of code:

Copy

```
from lmnr import Laminar

def request_handler(user_message: str):
    with Laminar.start_as_current_span(
        name="handler",
        input=user_message
    ) as span:
        # Your code here

        # Set output of the current span
        Laminar.set_span_output(result)
        return result

```

[Overview](https://docs.lmnr.ai/tracing/structure/overview) [Manual Span Creation](https://docs.lmnr.ai/tracing/structure/manual-span-creation)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![OpenAI span as a child](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-observe.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=c7136e18a6e60b1524fbfb3ec13885bc)
