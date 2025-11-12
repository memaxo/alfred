---
title: Observability for Skyvern - Laminar documentation
url: 
description: Trace Skyvern's browser automation workflows and LLM calls with Laminar
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/integrations/skyvern#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

Observability for Skyvern

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/skyvern#overview)
- [Quickstart](https://docs.lmnr.ai/tracing/integrations/skyvern#quickstart)
- [Viewing Traces](https://docs.lmnr.ai/tracing/integrations/skyvern#viewing-traces)

## [​](https://docs.lmnr.ai/tracing/integrations/skyvern\#overview)  Overview

[Skyvern](https://github.com/Skyvern-AI/skyvern) is an open-source browser automation framework that uses LLMs and Computer Vision to automate browser-based workflows.Laminar provides comprehensive instrumentation of Skyvern with all core functions being traced automatically. This includes full browser session recordings that capture every interaction, making it immensely valuable for debugging failed workflows and evaluating automation performance.

Laminar excels at tracing AI-powered browser automation by providing visibility into LLM decision-making processes, browser interaction outcomes, and complete session recordings synchronized with execution steps.

## [​](https://docs.lmnr.ai/tracing/integrations/skyvern\#quickstart)  Quickstart

To trace Skyvern workflows with Laminar, **initialize Laminar and configure LiteLLM callbacks at the top of your project**. This will automatically capture all LLM calls, browser session recordings, and workflow execution details.

Copy

```
from skyvern import Skyvern
import asyncio
import litellm
from lmnr import Laminar, LaminarLiteLLMCallback, Instruments
from dotenv import load_dotenv

load_dotenv()

# Initialize Laminar
# This will automatically trace all Skyvern functions
# Disable OpenAI to avoid double instrumentation of LLM calls
Laminar.initialize(disabled_instruments=set([Instruments.OPENAI]))

# Configure LiteLLM to trace all LLM calls made by Skyvern
litellm.callbacks = [LaminarLiteLLMCallback()]

skyvern = Skyvern()

async def main():
    task = await skyvern.run_task(
        prompt="go to lmnr.ai, summarize the pricing page."
    )
    print(task)

if __name__ == "__main__":
    asyncio.run(main())

```

## [​](https://docs.lmnr.ai/tracing/integrations/skyvern\#viewing-traces)  Viewing Traces

You can view traces in the Laminar UI by navigating to the traces tab in your project. When you select a trace, you can see:

- **Browser Session Recording**: Full video recording of the browser window synchronized with execution steps - immensely valuable for debugging failed workflows and evaluating automation quality
- **LLM Interactions**: All prompts sent to the language model and their responses
- **Workflow Steps**: Sequential execution of tasks and their outcomes
- **Performance Metrics**: Latency, token usage, and cost
- **Image tracing**: Browser screenshots that were sent to LLM for analysis
- **Error Handling**: Exceptions and errors that occurred during the execution

The trace timeline shows the complete workflow execution with synchronized browser recordings, making it easy to debug issues, understand failure points, and optimize performance. This is particularly powerful for evaluations where you can visually verify whether the automation achieved the intended outcome.

![Skyvern trace](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/skyvern.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=7b5fd5e364819e138f5c52f486211012)

[Stagehand](https://docs.lmnr.ai/tracing/integrations/stagehand) [Overview](https://docs.lmnr.ai/tracing/structure/overview)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Skyvern trace](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/skyvern.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=9ac2fd31e3eb704795a14c9e0e01a335)