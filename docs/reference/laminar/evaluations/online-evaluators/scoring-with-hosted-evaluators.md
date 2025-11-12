---
title: Scoring with Hosted Evaluators - Laminar documentation
url: 
description: Step-by-step examples of setting up online evaluators in Laminar
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-hosted-evaluators#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Online Evaluators

Scoring with Hosted Evaluators

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Creating a Basic Online Evaluator](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-hosted-evaluators#creating-a-basic-online-evaluator)

## [​](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-hosted-evaluators\#creating-a-basic-online-evaluator)  Creating a Basic Online Evaluator

This example walks through setting up a simple online evaluator that checks if an LLM response contains specific keywords, useful for content moderation or topic classification.

1

1\. Navigate to Evaluators Page

From your Laminar dashboard, go to the Evaluators page and click “New Evaluator” to start creating your custom evaluation logic.

2

2\. Define Your Evaluator Function

Create a Python function that analyzes the LLM output. This example checks for the presence of specific keywords and assigns a score based on relevance.**Important**: Online evaluator functions must return a single number as the score. The system automatically attaches this score to the span for monitoring and analysis.

Copy

```
def keyword_checker(input):
    """
    Evaluator that checks if the output contains relevant keywords
    Returns a score from 0 to 1 based on keyword presence
    Note: Must return a single number as the score
    """
    def extract_text(data):
        if isinstance(data, str):
            return data
        if isinstance(data, dict) and 'content' in data:
            content = data['content']
            if isinstance(content, str):
                return content
            if isinstance(content, list) and content:
                first = content[0]
                return first.get('text', str(first)) if isinstance(first, dict) else str(first)
        return str(data)

    text_content = extract_text(input)
    important_keywords = ['solution', 'help', 'recommend', 'suggest']

    keyword_count = sum(1 for keyword in important_keywords if keyword in text_content.lower())
    return min(keyword_count / len(important_keywords), 1.0)

```

![Create evaluator function](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/create-evaluator-function.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=006e9924c82af391e192b9d9276cc702)

3

3\. Test Your Evaluator

Use the test interface to verify your evaluator works correctly with sample inputs.

Copy

```
{
    "content": [\
        {"text": "Let me suggest a helpful approach"}\
    ]
}

```

![Test evaluator](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/test.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=42cf5f7edbf95e88ca9350c876ede23e)

4

4\. Register to Span Path

Navigate to your traces, find a span representing the LLM call you want to evaluate, and register your evaluator to that specific span path by clicking evaluators on span view.

![Register to span path](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/span-path.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=d68a2123290c8431b6f590fcbcfc3cc7)

5

5\. Verify Automatic Execution

After registration, new spans on that path will automatically trigger your evaluator. Check the span details to see the attached evaluation scores.

![Verify execution - evaluator scores displayed in span](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/score.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=91c3b78db2de15668309053d8645afed)

[Introduction](https://docs.lmnr.ai/evaluations/online-evaluators/introduction) [Scoring with SDK](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Create evaluator function](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/create-evaluator-function.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=b0f90df181e0302a9975b94eb79f7ac5)

![Test evaluator](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/test.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=9eb4026bd0cbcdad5e92765012ac136b)

![Register to span path](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/span-path.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=186d5ef00c5c7e7200b8a195b7cc76d5)

![Verify execution - evaluator scores displayed in span](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/online-evaluators/score.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=c5d8e6cb802d9f91bfa88930a6cfb30e)