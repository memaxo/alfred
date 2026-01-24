---
title: LLM Observability with Laminar Tracing - Laminar documentation
url:
description: Comprehensive observability for your LLM applications with OpenTelemetry-based tracing
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/introduction#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

LLM Observability with Laminar Tracing

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [What is Laminar Tracing?](https://docs.lmnr.ai/tracing/introduction#what-is-laminar-tracing%3F)
- [Key Concepts](https://docs.lmnr.ai/tracing/introduction#key-concepts)
- [Span](https://docs.lmnr.ai/tracing/introduction#span)
- [Trace](https://docs.lmnr.ai/tracing/introduction#trace)
- [Session](https://docs.lmnr.ai/tracing/introduction#session)
- [What Laminar Captures](https://docs.lmnr.ai/tracing/introduction#what-laminar-captures)
- [Performance Metrics](https://docs.lmnr.ai/tracing/introduction#performance-metrics)
- [LLM-Specific Data](https://docs.lmnr.ai/tracing/introduction#llm-specific-data)
- [Inputs & Outputs](https://docs.lmnr.ai/tracing/introduction#inputs-%26-outputs)
- [Execution Flow](https://docs.lmnr.ai/tracing/introduction#execution-flow)
- [Next Steps](https://docs.lmnr.ai/tracing/introduction#next-steps)

## [​](https://docs.lmnr.ai/tracing/introduction#what-is-laminar-tracing%3F) What is Laminar Tracing?

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/traces.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=d35c171198d09923901ef82f10f2119b)

Laminar offers comprehensive observability for your LLM applications, capturing the entire execution flow with minimal setup. This allows you to:

- **Debug complex Agents and LLM workflows** by seeing exactly how data flows through your application
- **Monitor performance** with detailed execution time and token usage metrics
- **Track costs** across different models and components
- **Analyze user sessions** to understand and improve the end-user experience

## [​](https://docs.lmnr.ai/tracing/introduction#key-concepts) Key Concepts

Example of a trace view on the Laminar platform:

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-view.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=75638a547a4a711f228821b8a49a1ffa)

### [​](https://docs.lmnr.ai/tracing/introduction#span) Span

A single operation in your application’s execution flow, such as LLM call, function call, or API request. In the screenshot above, the spans are the nodes in the tree view.
Selected span `gemini.generate_content` is highlighted in red and represents the LLM call to Gemini model.Each span has:

- **Name**: The name of the span (e.g., `gemini.generate_content`)
- **Input**: The input of the function representing a span. In case of an LLM call, this is the prompt.
- **Output**: The output of the function representing a span. In case of an LLM call, this is the response from the model.
- **Duration**: How long the operation took to execute
- **Path**: Hierarchical path of the span in the trace (e.g., `get_user.validate.api_call`).
- **Attributes**: Input parameters, return values, and other metadata

### [​](https://docs.lmnr.ai/tracing/introduction#trace) Trace

Trace is a collection of spans that form a complete execution path. In the screenshot above, spans of the trace are highlighted in blue.
Traces spans within a trace show parent-child relationships between operations, helping you understand how your code executes.

### [​](https://docs.lmnr.ai/tracing/introduction#session) Session

Laminar helps you group related traces belonging to the same user interaction or conversation under a session.
It can be used to group traces of a multi-turn conversation, or complex workflows.

## [​](https://docs.lmnr.ai/tracing/introduction#what-laminar-captures) What Laminar Captures

For every execution of your application, Laminar automatically records:

### [​](https://docs.lmnr.ai/tracing/introduction#performance-metrics) Performance Metrics

- Total execution time
- Per-span execution times
- Bottlenecks and slow operations

### [​](https://docs.lmnr.ai/tracing/introduction#llm-specific-data) LLM-Specific Data

- Token counts (input and output)
- Model information
- Cost calculations

### [​](https://docs.lmnr.ai/tracing/introduction#inputs-%26-outputs) Inputs & Outputs

- Function parameters
- Return values
- Prompts and completions

### [​](https://docs.lmnr.ai/tracing/introduction#execution-flow) Execution Flow

- Parent-child relationships
- Complete call hierarchy
- Cross-service transactions

## [​](https://docs.lmnr.ai/tracing/introduction#next-steps) Next Steps

Now that you understand the basics of Laminar tracing:

- Get started quickly with our [Quickstart Guide](https://docs.lmnr.ai/tracing/quickstart)
- Explore our integrations to see how Laminar works with your favorite tools:
  - [OpenAI](https://docs.lmnr.ai/tracing/integrations/openai)
  - [Anthropic](https://docs.lmnr.ai/tracing/integrations/anthropic)
  - [Gemini](https://docs.lmnr.ai/tracing/integrations/gemini)
  - [Langchain](https://docs.lmnr.ai/tracing/integrations/langchain)
  - [Next.js](https://docs.lmnr.ai/tracing/integrations/nextjs)
  - [Vercel AI SDK](https://docs.lmnr.ai/tracing/integrations/vercel-ai-sdk)
  - [LiteLLM](https://docs.lmnr.ai/tracing/integrations/litellm)
  - [Playwright](https://docs.lmnr.ai/tracing/integrations/playwright)
  - [Puppeteer](https://docs.lmnr.ai/tracing/integrations/puppeteer)
  - [Browser Use](https://docs.lmnr.ai/tracing/integrations/browser-use)
  - [Stagehand](https://docs.lmnr.ai/tracing/integrations/stagehand)
- Continue to [Trace Structure](https://docs.lmnr.ai/tracing/structure) to learn more about how to add structure to your traces
- Explore [Browser agent observability](https://docs.lmnr.ai/tracing/browser-agent-observability) to learn how to record browser sessions and sync them with agent execution steps

[Cursor Rules](https://docs.lmnr.ai/cursor) [Quickstart](https://docs.lmnr.ai/tracing/quickstart)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/traces.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=1141989aa2ce0854ec184286d401ca65)

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-view.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=4f41a275ac9a00b46a8d2acf24586107)
