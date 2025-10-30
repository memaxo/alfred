---
title: Scoring with SDK - Laminar documentation
url: 
description: Programmatically create evaluator scores using our SDK
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Online Evaluators

Scoring with SDK

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Create Evaluator Score](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk#create-evaluator-score)
- [Code Examples](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk#code-examples)
- [Viewing Scores in UI](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk#viewing-scores-in-ui)
- [API Reference](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk#api-reference)

## [​](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk\#create-evaluator-score)  Create Evaluator Score

Create a score for a span using either a trace ID or span ID. When using a trace ID, the score will be attached to the root span of that trace.

### [​](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk\#code-examples)  Code Examples

TypeScript

Python

Copy

```
import { LaminarClient, Laminar, observe } from "@lmnr-ai/lmnr";

const laminarClient = new LaminarClient({
  apiKey: "your-project-api-key"
});

// First, capture your LLM calls
await observe(
  {
    name: "chat_completion",
    input: { messages: [...] },
  },
  () => {
    // Your LLM call here
    return {
      output: { content: "AI response" }
    };
  }
);

// IMPORTANT: Flush data to ensure it reaches the backend
await Laminar.flush();

// Score by trace ID (attaches to root span)
const traceId = Laminar.getTraceId();
if (!traceId) {
  // To avoid this, we must be inside an observed function
  throw new Error("No active trace found");
}

await laminarClient.evaluators.score({
  name: "quality",
  traceId: traceId,
  score: 0.95,
  metadata: { model: "gpt-4" }
});

// Score by span ID
// IMPORTANT: This code must be run after span is already recorded
// In production, ensure this runs later
await new Promise(resolve => setTimeout(resolve, 1000));

const spanContext = Laminar.getLaminarSpanContext();
if (!spanContext) {
  throw new Error("No active span found");
}

await laminarClient.evaluators.score({
  name: "relevance",
  spanId: spanContext.spanId,
  score: 0.87
});

```

## [​](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk\#viewing-scores-in-ui)  Viewing Scores in UI

When you create evaluator scores, they will appear in your Laminar dashboard attached to the corresponding spans:

![Evaluator scores displayed in span details](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/score.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=91c3b78db2de15668309053d8645afed)

## [​](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk\#api-reference)  API Reference

For detailed API specifications including request/response schemas, visit: [**Create Evaluator Score** \\
\\
Create scores for spans using trace ID or span ID](https://docs.lmnr.ai/api-reference/evaluators/create-evaluator-score)

[Scoring with Hosted Evaluators](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-hosted-evaluators) [Introduction](https://docs.lmnr.ai/sql-editor/introduction)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Evaluator scores displayed in span details](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/score.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=c5d8e6cb802d9f91bfa88930a6cfb30e)