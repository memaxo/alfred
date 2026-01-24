---
title: LLM Observability for Cohere SDK - Laminar documentation
url:
description: Instrument your Cohere Chat, Embed, and Rerank API calls with Laminar
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/integrations/cohere#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

LLM Observability for Cohere SDK

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/cohere#overview)
- [Getting Started (Python)](https://docs.lmnr.ai/tracing/integrations/cohere#getting-started-python)
- [1\. Install Laminar and Cohere](https://docs.lmnr.ai/tracing/integrations/cohere#1-install-laminar-and-cohere)
- [2\. Set up your environment variables](https://docs.lmnr.ai/tracing/integrations/cohere#2-set-up-your-environment-variables)
- [3\. Initialize Laminar and Cohere client](https://docs.lmnr.ai/tracing/integrations/cohere#3-initialize-laminar-and-cohere-client)
- [Use Cohere as usual](https://docs.lmnr.ai/tracing/integrations/cohere#use-cohere-as-usual)
- [Chat (Command family)](https://docs.lmnr.ai/tracing/integrations/cohere#chat-command-family)
- [Streaming Chat](https://docs.lmnr.ai/tracing/integrations/cohere#streaming-chat)
- [RAG with Documents (Observed Pipeline)](https://docs.lmnr.ai/tracing/integrations/cohere#rag-with-documents-observed-pipeline)
- [Rerank](https://docs.lmnr.ai/tracing/integrations/cohere#rerank)
- [Semantic Search (Embeddings)](https://docs.lmnr.ai/tracing/integrations/cohere#semantic-search-embeddings)
- [Monitoring Your Cohere Usage](https://docs.lmnr.ai/tracing/integrations/cohere#monitoring-your-cohere-usage)
- [Advanced Features](https://docs.lmnr.ai/tracing/integrations/cohere#advanced-features)

## [​](https://docs.lmnr.ai/tracing/integrations/cohere#overview) Overview

Laminar automatically instruments the official Cohere Python SDK with a single line of code, allowing you to trace and monitor all your Cohere API calls without modifying your existing code. This provides complete visibility into your AI application’s performance, costs, and behavior.

## [​](https://docs.lmnr.ai/tracing/integrations/cohere#getting-started-python) Getting Started (Python)

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#1-install-laminar-and-cohere) 1\. Install Laminar and Cohere

Copy

```
pip install 'lmnr[all]' cohere python-dotenv

```

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#2-set-up-your-environment-variables) 2\. Set up your environment variables

Store your API keys in a `.env` file:

Copy

```
# .env file
LMNR_PROJECT_API_KEY=your-laminar-project-api-key
COHERE_API_KEY=your-cohere-api-key

```

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#3-initialize-laminar-and-cohere-client) 3\. Initialize Laminar and Cohere client

Just add a single line at the start of your application or file to instrument Cohere with Laminar.

Copy

```
from lmnr import Laminar
import cohere
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# This single line instruments all Cohere API calls
Laminar.initialize()

# Initialize Cohere client as usual (v2 client)
co = cohere.ClientV2(os.environ["COHERE_API_KEY"])

```

## [​](https://docs.lmnr.ai/tracing/integrations/cohere#use-cohere-as-usual) Use Cohere as usual

After initialization, make API calls to Cohere exactly as you normally would. Laminar will automatically capture traces for Chat, Embed, and Rerank endpoints.

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#chat-command-family) Chat (Command family)

Copy

```
response = co.chat(
    model="command-a-03-2025",
    messages=[\
        {"role": "user", "content": "Write a one-sentence intro for my new startup teammates."}\
    ],
)

print(response.message.content[0].text)

```

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#streaming-chat) Streaming Chat

Copy

```
res = co.chat_stream(
    model="command-a-03-2025",
    messages=[\
        {"role": "user", "content": "Write a one-sentence intro for my new startup teammates."}\
    ],
)

for chunk in res:
    if chunk and getattr(chunk, "type", None) == "content-delta":
        print(chunk.delta.message.content.text, end="")

```

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#rag-with-documents-observed-pipeline) RAG with Documents (Observed Pipeline)

Copy

```
from lmnr import observe

@observe(name="retrieve_documents")
def retrieve_documents(query: str):
    return [\
        {"data": {"text": "Reimbursing Travel Expenses: Submit expenses via the finance tool."}},\
        {"data": {"text": "Working from Abroad: Coordinate with your manager and keep core hours."}},\
        {"data": {"text": "Health Benefits: Gym memberships, on-site yoga, and health insurance."}},\
    ]

@observe(name="generate_answer")
def generate_answer(query: str, documents: list):
    return co.chat(
        model="command-a-03-2025",
        messages=[{"role": "user", "content": query}],
        documents=documents,
    )

@observe(name="rag_pipeline")
def rag_pipeline(query: str):
    docs = retrieve_documents(query)
    return generate_answer(query, docs)

resp = rag_pipeline("Are there health benefits?")
print(resp.message.content[0].text)

if resp.message.citations:
    for citation in resp.message.citations:
        print(citation, "\n")

```

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#rerank) Rerank

Copy

```
query = "observability for LLM applications"
documents = [\
    "Cohere provides an Embed API for creating vector representations of text.",\
    "Laminar enables tracing and monitoring of LLM calls.",\
    "OpenAI offers GPT models for chat and text generation."\
]

rerank_response = co.rerank(
    model="rerank-v3.5",
    query=query,
    documents=documents,
    top_n=3,
)

for result in rerank_response.results:
    print(result.index, result.relevance_score, documents[result.index])

```

### [​](https://docs.lmnr.ai/tracing/integrations/cohere#semantic-search-embeddings) Semantic Search (Embeddings)

Copy

```
import numpy as np

docs = [\
    "Laminar provides LLM tracing and analytics.",\
    "Cohere offers models for chat, embedding, and reranking.",\
    "OpenTelemetry is an observability framework for cloud software.",\
]

# Embed documents
doc_emb = co.embed(
    model="embed-v4.0",
    texts=docs,
    input_type="search_document",
).embeddings

# Embed query
query_emb = co.embed(
    model="embed-v4.0",
    texts=["observability for LLM applications"],
    input_type="search_query",
).embeddings[0]

# Compute cosine similarity
def cosine(a, b):
    a = np.array(a)
    b = np.array(b)
    return float(a.dot(b) / (np.linalg.norm(a) * np.linalg.norm(b)))

sims = [(i, cosine(query_emb, e)) for i, e in enumerate(doc_emb)]
for i, score in sorted(sims, key=lambda x: x[1], reverse=True):
    print(i, round(score, 4), docs[i])

```

All Cohere API calls are now automatically traced in Laminar.

## [​](https://docs.lmnr.ai/tracing/integrations/cohere#monitoring-your-cohere-usage) Monitoring Your Cohere Usage

After instrumenting your Cohere calls with Laminar, you’ll be able to:

1. **View detailed traces** of each Cohere API call, including request and response
2. **Track token usage and cost** across different models
3. **Monitor latency** and performance metrics
4. **Open LLM span in Playground** for prompt engineering
5. **Debug issues** with failed API calls or unexpected model outputs

Visit your Laminar dashboard to view your Cohere traces and analytics.

## [​](https://docs.lmnr.ai/tracing/integrations/cohere#advanced-features) Advanced Features

- [Sessions](https://docs.lmnr.ai/tracing/structure/session) \- Learn how to add session structure to your traces
- [Metadata](https://docs.lmnr.ai/tracing/structure/metadata) \- Discover how to add additional context to your LLM spans
- [Trace structure](https://docs.lmnr.ai/tracing/structure) \- Explore creating custom spans and more advanced tracing
- [Realtime Monitoring](https://docs.lmnr.ai/tracing/realtime) \- See how to monitor your Cohere calls in real-time

[LangChain](https://docs.lmnr.ai/tracing/integrations/langchain) [Next.js](https://docs.lmnr.ai/tracing/integrations/nextjs)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
