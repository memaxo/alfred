---
title: Tracing LLM calls in FastAPI with Laminar - Laminar documentation
url: 
description: FastAPI Integration with Laminar Tracing
language: en
---
[Skip to main content](https://docs.lmnr.ai/guides/fastapi#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing LLM calls in FastAPI with Laminar

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/guides/fastapi#overview)
- [Setup](https://docs.lmnr.ai/guides/fastapi#setup)
- [Implementation](https://docs.lmnr.ai/guides/fastapi#implementation)
- [1\. schemas.py](https://docs.lmnr.ai/guides/fastapi#1-schemas-py)
- [2\. llm.py](https://docs.lmnr.ai/guides/fastapi#2-llm-py)
- [3\. main.py](https://docs.lmnr.ai/guides/fastapi#3-main-py)
- [Running the Application](https://docs.lmnr.ai/guides/fastapi#running-the-application)
- [Testing the API](https://docs.lmnr.ai/guides/fastapi#testing-the-api)
- [Viewing Traces](https://docs.lmnr.ai/guides/fastapi#viewing-traces)
- [Key Features Demonstrated](https://docs.lmnr.ai/guides/fastapi#key-features-demonstrated)
- [Troubleshooting](https://docs.lmnr.ai/guides/fastapi#troubleshooting)

## [​](https://docs.lmnr.ai/guides/fastapi\#overview)  Overview

We’ll create a FastAPI application that:

1. Accepts support ticket submissions
2. Uses an LLM to classify the ticket
3. Returns the classification result
4. Traces the entire process with Laminar

## [​](https://docs.lmnr.ai/guides/fastapi\#setup)  Setup

You can also use the example app from our GitHub [repo](https://github.com/lmnr-ai/lmnr-python/tree/main/examples/fastapi-app).Alternatively, for a clean install, follow the steps below:

1

Install Dependencies

First, let’s install the required packages:

Copy

```
pip install fastapi uvicorn openai lmnr python-dotenv

```

2

Environment Setup

Create a `.env` file with your API keys:

Copy

```
LMNR_PROJECT_API_KEY="your-laminar-project-api-key"
OPENAI_API_KEY="your-openai-api-key"

```

3

Project Structure

Create the following project structure:

Copy

```
fastapi-app/
├── .env
├── requirements.txt
└── src/
    ├── main.py
    ├── llm.py
    └── schemas.py

```

## [​](https://docs.lmnr.ai/guides/fastapi\#implementation)  Implementation

Let’s create our FastAPI application with Laminar tracing. We’ll split the code into three files:

### [​](https://docs.lmnr.ai/guides/fastapi\#1-schemas-py)  1\. schemas.py

This file will contain the Pydantic models for the request and response.

schemas.py

Copy

```
from enum import Enum
from pydantic import BaseModel

class TicketCategory(str, Enum):
    REFUND = "REFUND"
    BUG = "BUG"
    QUESTION = "QUESTION"
    OTHER = "OTHER"

class Ticket(BaseModel):
    title: str
    description: str
    customer_email: str

class TicketClassification(BaseModel):
    category: TicketCategory
    reasoning: str

```

### [​](https://docs.lmnr.ai/guides/fastapi\#2-llm-py)  2\. llm.py

This file will contain the logic that handles the LLM. In a production app,
this will likely be a much bigger module with classes, routing, etc.For now, we’ll just have a function that handles an OpenAI call.

llm.py

Copy

```
from dotenv import load_dotenv
from lmnr import observe
from openai import OpenAI
from schemas import Ticket, TicketCategory, TicketClassification

import os

load_dotenv(override=True)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@observe()
def model_classify_ticket(ticket: Ticket) -> TicketClassification:
    response = client.beta.chat.completions.parse(
        model="gpt-4.1-nano",
        response_format=TicketClassification,
        messages=[\
            {\
                "role": "system",\
                "content": """You are a support ticket classifier.\
Classify the ticket that a user sends you""",\
            },\
            {\
                "role": "user",\
                "content": f"""Title: {ticket.title}\
Description: {ticket.description}\
Customer Email: {ticket.customer_email}""",\
            },\
        ],
    )

    return response.choices[0].message.parsed or TicketClassification(
        category=TicketCategory.OTHER,
        reasoning=response.choices[0].message.content,
    )

```

### [​](https://docs.lmnr.ai/guides/fastapi\#3-main-py)  3\. main.py

This file will contain the logic that handles the FastAPI app.

Laminar must be initialized once at the entry point of the application.
For FastAPI, this is typically `main.py`, right before creating `app`.

main.py

Copy

```
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from llm import model_classify_ticket
from lmnr import Laminar
from schemas import Ticket, TicketClassification

load_dotenv(override=True)

# Laminar must be initialized once, preferably at the entry point of the application
Laminar.initialize()

app = FastAPI()

@app.post("/api/v1/tickets/classify", response_model=TicketClassification)
async def classify_ticket(ticket: Ticket):
    try:
        classification = model_classify_ticket(ticket)
        print(classification)
        return classification
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

```

## [​](https://docs.lmnr.ai/guides/fastapi\#running-the-application)  Running the Application

Start the FastAPI server:

Copy

```
uvicorn src.main:app --reload --port 8011

```

## [​](https://docs.lmnr.ai/guides/fastapi\#testing-the-api)  Testing the API

You can test the API using curl:

Copy

```
curl --location 'localhost:8011/api/v1/tickets/classify' \
--header 'Content-Type: application/json' \
--data-raw '{
    "title": "Can'\''t access my account",
    "description": "I'\''ve been trying to log in for the past hour but keep getting an error message",
    "customer_email": "user@example.com"
}'

```

## [​](https://docs.lmnr.ai/guides/fastapi\#viewing-traces)  Viewing Traces

After making a request, you can view the traces in your Laminar dashboard at [https://www.lmnr.ai](https://www.lmnr.ai/). The trace will show:

1. The ticket classification function execution
2. The OpenAI API call

## [​](https://docs.lmnr.ai/guides/fastapi\#key-features-demonstrated)  Key Features Demonstrated

1. **Automatic Tracing**: Laminar automatically traces OpenAI calls and functions marked with `@observe`
2. **Tokens Usage**: Laminar automatically calculates the tokens used for each OpenAI call
3. **Cost Estimation**: Laminar automatically estimates the cost of each OpenAI call

## [​](https://docs.lmnr.ai/guides/fastapi\#troubleshooting)  Troubleshooting

If you encounter issues:

- Check that your API keys are correctly set in the `.env` file and that it is loaded correctly
- Verify that Laminar is properly initialized
- Ensure all dependencies are installed
- Review the FastAPI logs for any application errors

[Tracing AI SDK in Next.js](https://docs.lmnr.ai/guides/nextjs-aisdk)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.