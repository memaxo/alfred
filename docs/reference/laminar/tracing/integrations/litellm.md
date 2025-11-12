---
title: LLM Observability for LiteLLM - Laminar documentation
url: 
description: Configure LiteLLM to send traces to Laminar
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/integrations/litellm#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

LLM Observability for LiteLLM

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/litellm#overview)
- [Default configuration](https://docs.lmnr.ai/tracing/integrations/litellm#default-configuration)

## [​](https://docs.lmnr.ai/tracing/integrations/litellm\#overview)  Overview

[LiteLLM](https://www.litellm.ai/) is a framework/library for building LLM applications that simplifies accessing many models across different providers.

## [​](https://docs.lmnr.ai/tracing/integrations/litellm\#default-configuration)  Default configuration

1

Ensure you have the latest version of Laminar

Copy

```
pip install -U lmnr[all]

```

2

Initialize Laminar and integrate the callback

You need to initialize Laminar **before** adding the callback to LiteLLM.

Copy

```
import litellm
from lmnr import Laminar, LaminarLiteLLMCallback

# 1. Initialize Laminar
Laminar.initialize(project_api_key="LMNR_PROJECT_API_KEY")

# 2. Integrate the callback
litellm.callbacks = [LaminarLiteLLMCallback()]

```

3

Run your code and see traces in Laminar

Example code:

Copy

```
import litellm
from lmnr import Laminar, LaminarLiteLLMCallback

Laminar.initialize(project_api_key="LMNR_PROJECT_API_KEY")
litellm.callbacks = [LaminarLiteLLMCallback()]

response = litellm.completion(
    model="gpt-4.1-nano",
    messages=[\
      {"role": "user", "content": "What is the capital of France?"}\
    ],
)

```

![LiteLLM trace](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/litellm.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=4a82323756cd93c5ba0e7919cf30cf4e)

[Vercel AI SDK](https://docs.lmnr.ai/tracing/integrations/vercel-ai-sdk) [Playwright](https://docs.lmnr.ai/tracing/integrations/playwright)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![LiteLLM trace](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/litellm.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=ac1606992d8f23d1419a9bb7b1753fe5)