---
title: LLM cost tracking - Laminar documentation
url:
description: Overview of supported LLM providers and model names for accurate cost tracking
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/structure/providers#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

LLM cost tracking

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/structure/providers#overview)
- [Supported Providers](https://docs.lmnr.ai/tracing/structure/providers#supported-providers)
- [Setting Provider Information](https://docs.lmnr.ai/tracing/structure/providers#setting-provider-information)
- [Model Name Formats](https://docs.lmnr.ai/tracing/structure/providers#model-name-formats)
- [OpenAI](https://docs.lmnr.ai/tracing/structure/providers#openai)
- [Anthropic](https://docs.lmnr.ai/tracing/structure/providers#anthropic)
- [Google Gemini](https://docs.lmnr.ai/tracing/structure/providers#google-gemini)
- [Azure OpenAI](https://docs.lmnr.ai/tracing/structure/providers#azure-openai)
- [Custom Providers](https://docs.lmnr.ai/tracing/structure/providers#custom-providers)
- [Cost Calculation](https://docs.lmnr.ai/tracing/structure/providers#cost-calculation)
- [Viewing Costs](https://docs.lmnr.ai/tracing/structure/providers#viewing-costs)
- [Pricing Data](https://docs.lmnr.ai/tracing/structure/providers#pricing-data)
- [Best Practices](https://docs.lmnr.ai/tracing/structure/providers#best-practices)
- [Always Set Provider Info](https://docs.lmnr.ai/tracing/structure/providers#always-set-provider-info)
- [Use Exact Model Names](https://docs.lmnr.ai/tracing/structure/providers#use-exact-model-names)
- [Handle Missing Usage Data](https://docs.lmnr.ai/tracing/structure/providers#handle-missing-usage-data)

## [​](https://docs.lmnr.ai/tracing/structure/providers#overview) Overview

Laminar automatically calculates costs for LLM calls when the correct provider and model names are set. This page lists the supported providers and their corresponding model names that Laminar recognizes for cost calculation.

## [​](https://docs.lmnr.ai/tracing/structure/providers#supported-providers) Supported Providers

Laminar uses provider names consistent with OpenLLMetry standards. When manually instrumenting LLM calls, set the `gen_ai.system` attribute to one of these values:

| Provider          | Provider Name            | Example Model                                     | Documentation                                                                                            |
| ----------------- | ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **OpenAI**        | `openai`                 | `gpt-4o`, `gpt-4o-2024-11-20`                     | [platform.openai.com](https://platform.openai.com/docs/models)                                           |
| **Anthropic**     | `anthropic`              | `claude-3-5-sonnet`, `claude-3-5-sonnet-20241022` | [docs.anthropic.com](https://docs.anthropic.com/en/docs/about-claude/models#model-names)                 |
| **Google Gemini** | `gemini`, `google-genai` | `models/gemini-1.5-pro`                           | [ai.google.dev](https://ai.google.dev/gemini-api/docs/models/gemini)                                     |
| **Azure OpenAI**  | `azure-openai`           | `gpt-4o-mini`, `gpt-4o-mini-2024-07-18`           | [learn.microsoft.com](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)        |
| **AWS Bedrock**   | `bedrock-anthropic`      | `claude-3-5-sonnet-20241022-v2:0`                 | [docs.aws.amazon.com](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html) |
| **Mistral AI**    | `mistral`                | `mistral-large-2407`                              | [docs.mistral.ai](https://docs.mistral.ai/getting-started/models/models_overview/)                       |
| **Groq**          | `groq`                   | `llama-3.1-70b-versatile`                         | [console.groq.com](https://console.groq.com/docs/models)                                                 |

Missing a provider or can’t see cost information? [Create an issue](https://github.com/lmnr-ai/lmnr/issues/new) and we’ll add it.

## [​](https://docs.lmnr.ai/tracing/structure/providers#setting-provider-information) Setting Provider Information

When manually instrumenting LLM calls, ensure you set the correct provider and model attributes:

- JavaScript/TypeScript

- Python

Copy

```
import { Laminar, LaminarAttributes, observe } from '@lmnr-ai/lmnr';

await observe(
  { name: 'anthropicCall', spanType: 'LLM' },
  async () => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 100
      })
    }).then(res => res.json());

    // Set provider and model for cost calculation
    Laminar.setSpanAttributes({
      [LaminarAttributes.PROVIDER]: 'anthropic',
      [LaminarAttributes.RESPONSE_MODEL]: response.model,
      [LaminarAttributes.INPUT_TOKEN_COUNT]: response.usage.input_tokens,
      [LaminarAttributes.OUTPUT_TOKEN_COUNT]: response.usage.output_tokens,
    });

    return response;
  }
);

```

## [​](https://docs.lmnr.ai/tracing/structure/providers#model-name-formats) Model Name Formats

Different providers use different model name formats. Use the exact names as returned by the provider’s API:

### [​](https://docs.lmnr.ai/tracing/structure/providers#openai) OpenAI

Copy

```
// Standard models
"gpt-4o"
"gpt-4o-mini"
"gpt-3.5-turbo"

// Versioned models
"gpt-4o-2024-11-20"
"gpt-4o-mini-2024-07-18"

```

### [​](https://docs.lmnr.ai/tracing/structure/providers#anthropic) Anthropic

Copy

```
// Standard models
"claude-3-5-sonnet"
"claude-3-haiku"
"claude-3-opus"

// Versioned models
"claude-3-5-sonnet-20241022"
"claude-3-5-sonnet-20241022-v2:0"

```

### [​](https://docs.lmnr.ai/tracing/structure/providers#google-gemini) Google Gemini

Copy

```
// Full model paths
"models/gemini-1.5-pro"
"models/gemini-1.5-flash"
"models/gemini-1.0-pro"

```

### [​](https://docs.lmnr.ai/tracing/structure/providers#azure-openai) Azure OpenAI

Copy

```
// Same as OpenAI models
"gpt-4o"
"gpt-4o-mini-2024-07-18"

```

## [​](https://docs.lmnr.ai/tracing/structure/providers#custom-providers) Custom Providers

For providers not listed above, you can still track usage by setting custom attributes:

- JavaScript/TypeScript

- Python

Copy

```
// For custom or unsupported providers
Laminar.setSpanAttributes({
  [LaminarAttributes.PROVIDER]: 'custom-provider',
  [LaminarAttributes.RESPONSE_MODEL]: 'custom-model-v1',
  [LaminarAttributes.INPUT_TOKEN_COUNT]: response.usage.input_tokens,
  [LaminarAttributes.OUTPUT_TOKEN_COUNT]: response.usage.output_tokens,
  // Set explicit costs if known
  'gen_ai.usage.input_cost': 0.001,
  'gen_ai.usage.output_cost': 0.002,
  'gen_ai.usage.cost': 0.003
});

```

## [​](https://docs.lmnr.ai/tracing/structure/providers#cost-calculation) Cost Calculation

Laminar automatically calculates costs using:

1. **Token counts** ( `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`)
2. **Model name** ( `gen_ai.response.model`)
3. **Provider name** ( `gen_ai.system`)

Laminar also takes into account cached tokens to calculate cost for providers that support it, like OpenAI, Anthropic, and so on.

The cost calculation uses current pricing from each provider. If explicit cost attributes are provided, they take precedence over calculated costs.

### [​](https://docs.lmnr.ai/tracing/structure/providers#viewing-costs) Viewing Costs

Costs appear in the Laminar UI on:

- **Trace details** \- Sum of all LLM calls within the trace
- **LLM spans** \- Individual LLM call costs
- **Analytics dashboard** \- Aggregated cost metrics by models

## [​](https://docs.lmnr.ai/tracing/structure/providers#pricing-data) Pricing Data

Laminar maintains current pricing information for supported providers. For the complete list of supported models and their pricing, see the [pricing data in our GitHub repository](https://github.com/lmnr-ai/lmnr/blob/main/frontend/lib/db/initial-data.json#L25).

## [​](https://docs.lmnr.ai/tracing/structure/providers#best-practices) Best Practices

### [​](https://docs.lmnr.ai/tracing/structure/providers#always-set-provider-info) Always Set Provider Info

Copy

```
// ✅ Good - complete provider information
Laminar.setSpanAttributes({
  [LaminarAttributes.PROVIDER]: 'openai',
  [LaminarAttributes.RESPONSE_MODEL]: response.model,
  [LaminarAttributes.INPUT_TOKEN_COUNT]: response.usage.prompt_tokens,
  [LaminarAttributes.OUTPUT_TOKEN_COUNT]: response.usage.completion_tokens,
});

// ❌ Bad - missing provider or model
Laminar.setSpanAttributes({
  [LaminarAttributes.INPUT_TOKEN_COUNT]: response.usage.prompt_tokens,
});

```

### [​](https://docs.lmnr.ai/tracing/structure/providers#use-exact-model-names) Use Exact Model Names

Copy

```
// ✅ Good - exact model name from API response
[LaminarAttributes.RESPONSE_MODEL]: response.model

// ❌ Bad - hardcoded or modified model name
[LaminarAttributes.RESPONSE_MODEL]: 'gpt-4'

```

### [​](https://docs.lmnr.ai/tracing/structure/providers#handle-missing-usage-data) Handle Missing Usage Data

Copy

```
// Gracefully handle missing usage information
const inputTokens = response.usage?.prompt_tokens || 0;
const outputTokens = response.usage?.completion_tokens || 0;

if (inputTokens > 0 || outputTokens > 0) {
  Laminar.setSpanAttributes({
    [LaminarAttributes.INPUT_TOKEN_COUNT]: inputTokens,
    [LaminarAttributes.OUTPUT_TOKEN_COUNT]: outputTokens,
  });
}

```

Proper provider configuration ensures accurate cost tracking and better insights into your LLM usage patterns.

[Continuing Traces](https://docs.lmnr.ai/tracing/structure/continuing-traces) [Real-time Traces](https://docs.lmnr.ai/tracing/realtime)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
