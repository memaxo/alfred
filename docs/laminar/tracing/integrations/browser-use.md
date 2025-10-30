---
title: Observability for Browser Use - Laminar documentation
url: 
description: Trace Browser Use's agent execution steps and browser sessions
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/integrations/browser-use#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

Observability for Browser Use

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/browser-use#overview)
- [Usage](https://docs.lmnr.ai/tracing/integrations/browser-use#usage)
- [Viewing Traces](https://docs.lmnr.ai/tracing/integrations/browser-use#viewing-traces)

## [​](https://docs.lmnr.ai/tracing/integrations/browser-use\#overview)  Overview

[Browser Use](https://browser-use.com/) is a Python library that enables AI to control your browser.Laminar has a native tracing integration with Browser Use agent and underlying Playwright browser. It allows you to trace both agent execution steps and browser session recordings.

Laminar excels at tracing browser agents by providing unified visibility into both browser session recordings and agent execution steps.

## [​](https://docs.lmnr.ai/tracing/integrations/browser-use\#usage)  Usage

Simply initialize Laminar at the top of your project and both Browser Use agent’s steps and session recordings will be automatically traced and synced.

Copy

```
from langchain_anthropic import ChatAnthropic
from browser_use import Agent
import asyncio

from lmnr import Laminar
# this line instruments Browser Use and playwright browser
Laminar.initialize(project_api_key="...")

async def main():
    agent = Agent(
        task="go to ycombinator.com, describe 5 companies from the latest batch of startups.",
        llm=ChatAnthropic(model="claude-3-7-sonnet-20250219")
    )
    result = await agent.run()
    print(result)

asyncio.run(main())

```

## [​](https://docs.lmnr.ai/tracing/integrations/browser-use\#viewing-traces)  Viewing Traces

You can view traces in the Laminar UI by going to the traces tab in your project.
When you select a trace, you can see both the browser session recording and the agent execution steps.Timeline of the browser session is synced with the agent execution steps, timeline highlights indicate the agent’s current step synced with the browser session.![Browser Use Observability](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/integrations/bu_demo.gif?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=4efd5fbeade965fddc888e9cd009f1fc)

[Puppeteer](https://docs.lmnr.ai/tracing/integrations/puppeteer) [Stagehand](https://docs.lmnr.ai/tracing/integrations/stagehand)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.