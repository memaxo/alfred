---
title: LLM Observability for Gemini SDK - Laminar documentation
url:
description: Instrument your Google Gemini API calls with Laminar
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/integrations/gemini#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

LLM Observability for Gemini SDK

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/gemini#overview)
- [Getting Started](https://docs.lmnr.ai/tracing/integrations/gemini#getting-started)
- [1\. Install Laminar and Google Gemini](https://docs.lmnr.ai/tracing/integrations/gemini#1-install-laminar-and-google-gemini)
- [2\. Set up your environment variables](https://docs.lmnr.ai/tracing/integrations/gemini#2-set-up-your-environment-variables)
- [3\. Initialize Laminar](https://docs.lmnr.ai/tracing/integrations/gemini#3-initialize-laminar)
- [4\. Use Gemini as usual](https://docs.lmnr.ai/tracing/integrations/gemini#4-use-gemini-as-usual)
- [Monitoring Your Gemini Usage](https://docs.lmnr.ai/tracing/integrations/gemini#monitoring-your-gemini-usage)
- [Advanced Features](https://docs.lmnr.ai/tracing/integrations/gemini#advanced-features)

## [​](https://docs.lmnr.ai/tracing/integrations/gemini#overview) Overview

Laminar automatically instruments the official Google Gemini package with a single line of code, allowing you to trace and monitor all your Gemini API calls without modifying your existing code. This provides complete visibility into your AI application’s performance, costs, and behavior.

## [​](https://docs.lmnr.ai/tracing/integrations/gemini#getting-started) Getting Started

### [​](https://docs.lmnr.ai/tracing/integrations/gemini#1-install-laminar-and-google-gemini) 1\. Install Laminar and Google Gemini

Copy

```
pip install 'lmnr[all]' google-genai python-dotenv

```

You may remove the `[all]` extra, and there is no specific extra for Gemini.
Gemini instrumentation is currently shipped with the default `lmnr` package.

### [​](https://docs.lmnr.ai/tracing/integrations/gemini#2-set-up-your-environment-variables) 2\. Set up your environment variables

Store your API keys in a `.env` file:

Copy

```
# .env file
LMNR_PROJECT_API_KEY=your-laminar-project-api-key
GEMINI_API_KEY=your-gemini-api-key

```

To see an example of how to integrate Laminar within a FastAPI application, check out our [FastAPI integration guide](https://docs.lmnr.ai/guides/fastapi).

### [​](https://docs.lmnr.ai/tracing/integrations/gemini#3-initialize-laminar) 3\. Initialize Laminar

Just add a single line at the start of your application or file to instrument Gemini with Laminar.

Copy

```
from lmnr import Laminar
from google import genai
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# This single line instruments all Gemini API calls
Laminar.initialize()

# Initialize Gemini client as usual
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

```

### [​](https://docs.lmnr.ai/tracing/integrations/gemini#4-use-gemini-as-usual) 4\. Use Gemini as usual

Copy

```
# Make API calls to Gemini as you normally would
response = client.models.generate_content(
    model="gemini-2.5-flash-preview-04-17",
    contents="Tell me a short story about a robot learning to paint."
)

print(response.text)

```

All Gemini API calls are now automatically traced in Laminar.

## [​](https://docs.lmnr.ai/tracing/integrations/gemini#monitoring-your-gemini-usage) Monitoring Your Gemini Usage

After instrumenting your Gemini calls with Laminar, you’ll be able to:

1. **View detailed traces** of each Gemini API call, including request and response
2. **Track token usage and cost** across different models
3. **Monitor latency** and performance metrics
4. **Open LLM span in Playground** for prompt engineering
5. **Debug issues** with failed API calls or unexpected model outputs

Visit your Laminar dashboard to view your Gemini traces and analytics.

## [​](https://docs.lmnr.ai/tracing/integrations/gemini#advanced-features) Advanced Features

- [Sessions](https://docs.lmnr.ai/tracing/structure/session) \- Learn how to add session structure to your traces
- [Metadata](https://docs.lmnr.ai/tracing/structure/metadata) \- Discover how to add additional context to your LLM spans
- [Trace structure](https://docs.lmnr.ai/tracing/structure) \- Explore creating custom spans and more advanced tracing
- [Realtime Monitoring](https://docs.lmnr.ai/tracing/realtime) \- See how to monitor your Gemini calls in real-time

[Anthropic](https://docs.lmnr.ai/tracing/integrations/anthropic) [LangChain](https://docs.lmnr.ai/tracing/integrations/langchain)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
