---
title: LangGraph Visualization - Laminar documentation
url:
description: View LangGraph structure in trace view
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/langgraph-visualization#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

LangGraph Visualization

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Prerequisites](https://docs.lmnr.ai/tracing/langgraph-visualization#prerequisites)
- [Overview](https://docs.lmnr.ai/tracing/langgraph-visualization#overview)
- [Example: Multi-Step Research Workflow](https://docs.lmnr.ai/tracing/langgraph-visualization#example%3A-multi-step-research-workflow)
- [1\. Initialize Laminar](https://docs.lmnr.ai/tracing/langgraph-visualization#1-initialize-laminar)
- [2\. Define Your Graph State](https://docs.lmnr.ai/tracing/langgraph-visualization#2-define-your-graph-state)
- [3\. Create Traced Graph Nodes](https://docs.lmnr.ai/tracing/langgraph-visualization#3-create-traced-graph-nodes)
- [4\. Build the Graph Workflow](https://docs.lmnr.ai/tracing/langgraph-visualization#4-build-the-graph-workflow)

When you trace a LangGraph graph execution, Laminar automatically captures the graph structure and workflow, allowing you to visualize the entire graph flow directly in the trace view.

## [​](https://docs.lmnr.ai/tracing/langgraph-visualization#prerequisites) Prerequisites

You’ll need to install LangChain to work with LangGraph:

Copy

```
pip install langchain langchain-openai langgraph

```

## [​](https://docs.lmnr.ai/tracing/langgraph-visualization#overview) Overview

LangGraph creates complex, stateful, multi-actor applications with Large Language Models.
When these graphs are traced with Laminar, you can see complete graph structure and node relationships.

## [​](https://docs.lmnr.ai/tracing/langgraph-visualization#example%3A-multi-step-research-workflow) Example: Multi-Step Research Workflow

Here’s how to set up a LangGraph workflow with Laminar tracing:

### [​](https://docs.lmnr.ai/tracing/langgraph-visualization#1-initialize-laminar) 1\. Initialize Laminar

Copy

```
from lmnr import observe, Laminar

Laminar.initialize(project_api_key="your-project-api-key")

```

### [​](https://docs.lmnr.ai/tracing/langgraph-visualization#2-define-your-graph-state) 2\. Define Your Graph State

Copy

```
from typing import TypedDict, List
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI

class AgentState(TypedDict):
    messages: List[BaseMessage]
    research_results: str
    analysis: str
    final_recommendation: str

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.7,
    openai_api_key=OPENAI_API_KEY
)

```

### [​](https://docs.lmnr.ai/tracing/langgraph-visualization#3-create-traced-graph-nodes) 3\. Create Traced Graph Nodes

Copy

```
@observe(name="research_step")
async def research_step(state: AgentState) -> AgentState:
    result = await llm.ainvoke([HumanMessage(content=research_prompt)])
    state["research_results"] = result.content
    return state

@observe(name="analysis_step")
async def analysis_step(state: AgentState) -> AgentState:
    result = await llm.ainvoke([HumanMessage(content=analysis_prompt)])
    state["analysis"] = result.content
    return state

@observe(name="recommendation_step")
async def recommendation_step(state: AgentState) -> AgentState:
    result = await llm.ainvoke([HumanMessage(content=recommendation_prompt)])
    state["final_recommendation"] = result.content
    return state

```

### [​](https://docs.lmnr.ai/tracing/langgraph-visualization#4-build-the-graph-workflow) 4\. Build the Graph Workflow

Copy

```
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver

@observe(name="langchain_graph_workflow")
async def create_and_run_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("research_node", research_step)
    workflow.add_node("analysis_node", analysis_step)
    workflow.add_node("recommendation_node", recommendation_step)

    workflow.add_edge(START, "research_node")
    workflow.add_edge("research_node", "analysis_node")
    workflow.add_edge("analysis_node", "recommendation_node")
    workflow.add_edge("recommendation_node", END)

    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)

    config = {"configurable": {"thread_id": "demo-thread"}}

    final_state = await app.aget_state(config)

    return final_state

```

![](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/langgraph-visualization.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=0080be52d557ffdc2ab352996da1cba2)

[Browser agent observability](https://docs.lmnr.ai/tracing/browser-agent-observability) [Custom events](https://docs.lmnr.ai/tracing/events)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/langgraph-visualization.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=e1a6d2cd66114838263211a24b39da26)
