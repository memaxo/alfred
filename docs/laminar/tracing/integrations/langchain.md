---
title: Observability for LangChain / LangGraph - Laminar documentation
url: 
description: Instrument your LangChain and LangGraph applications with Laminar
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/integrations/langchain#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

Observability for LangChain / LangGraph

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/langchain#overview)
- [Getting Started](https://docs.lmnr.ai/tracing/integrations/langchain#getting-started)
- [1\. Install Laminar and LangChain/LangGraph](https://docs.lmnr.ai/tracing/integrations/langchain#1-install-laminar-and-langchain%2Flanggraph)
- [2\. Set up environment variables & Initialize Laminar](https://docs.lmnr.ai/tracing/integrations/langchain#2-set-up-environment-variables-%26-initialize-laminar)
- [3\. Use LangChain and LangGraph as usual](https://docs.lmnr.ai/tracing/integrations/langchain#3-use-langchain-and-langgraph-as-usual)
- [Monitoring Your LangChain Usage](https://docs.lmnr.ai/tracing/integrations/langchain#monitoring-your-langchain-usage)
- [Advanced Features](https://docs.lmnr.ai/tracing/integrations/langchain#advanced-features)

## [​](https://docs.lmnr.ai/tracing/integrations/langchain\#overview)  Overview

Laminar automatically instruments [LangChain](https://www.langchain.com/) and [LangGraph](https://www.langchain.com/langgraph) operations by simply initializing Laminar at the beginning of your Python application. This allows you to trace and monitor your LLM chains, agents, and graph-based workflows, providing complete visibility into your AI application’s performance, costs, and behavior without needing to modify your existing LangChain/LangGraph code.

## [​](https://docs.lmnr.ai/tracing/integrations/langchain\#getting-started)  Getting Started

### [​](https://docs.lmnr.ai/tracing/integrations/langchain\#1-install-laminar-and-langchain%2Flanggraph)  1\. Install Laminar and LangChain/LangGraph

You’ll need Laminar, LangChain core, any specific LangChain LLM/tool integrations (e.g., for OpenAI), and LangGraph:

Copy

```
pip install 'lmnr[all]' langchain langchain-openai langgraph python-dotenv
# Add other packages like langchain-community for specific tools if needed

```

### [​](https://docs.lmnr.ai/tracing/integrations/langchain\#2-set-up-environment-variables-%26-initialize-laminar)  2\. Set up environment variables & Initialize Laminar

Store your API keys in a `.env` file and initialize Laminar once at the start of your application, before any LangChain or LangGraph code is executed.

Copy

```
from lmnr import Laminar
from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Sequence
import operator

# Load environment variables from .env file
load_dotenv()

# Initialize Laminar - this single step enables automatic tracing
Laminar.initialize()

```

To see an example of how to integrate Laminar within a FastAPI application, check out our [FastAPI integration guide](https://docs.lmnr.ai/guides/fastapi).

### [​](https://docs.lmnr.ai/tracing/integrations/langchain\#3-use-langchain-and-langgraph-as-usual)  3\. Use LangChain and LangGraph as usual

**LangChain Example (Simple LLMChain):**

Copy

```
# Ensure Laminar.initialize() was called as shown in Step 2.

model = ChatOpenAI()
prompt = ChatPromptTemplate.from_messages([\
    ("system", "You are a helpful assistant."),\
    ("human", "{question}")\
])
output_parser = StrOutputParser()

chain = prompt | model | output_parser

# response = chain.invoke({"question": "What is the capital of France?"})
# print(response)

```

**LangGraph Example (Simple Graph):**

Copy

```
# Ensure Laminar.initialize() was called as shown in Step 2.

class AgentState(TypedDict):
    messages: Annotated[Sequence[HumanMessage], operator.add]

llm = ChatOpenAI()

def call_model(state: AgentState):
    messages = state['messages']
    response = llm.invoke(messages)
    return {"messages": [response]} # Append new message

# Define a new graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

app = workflow.compile()

# inputs = {"messages": [HumanMessage(content="Hi there!")]}
# result = app.invoke(inputs)
# print(result['messages'][-1].content)

```

All instrumentable LangChain and LangGraph operations are now automatically traced in Laminar.

## [​](https://docs.lmnr.ai/tracing/integrations/langchain\#monitoring-your-langchain-usage)  Monitoring Your LangChain Usage

After instrumenting your LangChain and LangGraph applications with Laminar, you’ll be able to:

1. **View detailed traces** of each chain, agent step, tool usage, and LLM call.
2. **Track token usage and cost** across different models used within LangChain.
3. **Monitor latency** and performance metrics for individual components and overall workflows.
4. **Analyze prompt engineering** by inspecting inputs/outputs at each step.
5. **Debug issues** with complex chains or graphs by visualizing their execution flow.

Visit your Laminar dashboard to view your LangChain traces and analytics.

## [​](https://docs.lmnr.ai/tracing/integrations/langchain\#advanced-features)  Advanced Features

Leverage Laminar’s advanced features to get more out of your LangChain instrumentation:

- [Sessions](https://docs.lmnr.ai/tracing/structure/session) \- Group related LangChain executions (e.g., a user conversation).
- [Metadata](https://docs.lmnr.ai/tracing/structure/metadata) \- Add custom context (e.g., user IDs, environment details) to your LangChain traces.
- [Trace structure](https://docs.lmnr.ai/tracing/structure) \- Create custom spans to instrument parts of your application logic outside of LangChain.
- [Realtime Monitoring](https://docs.lmnr.ai/tracing/realtime) \- Observe your LangChain applications in real-time.

[Gemini](https://docs.lmnr.ai/tracing/integrations/gemini) [Cohere](https://docs.lmnr.ai/tracing/integrations/cohere)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.