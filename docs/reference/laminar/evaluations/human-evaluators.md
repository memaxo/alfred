---
title: Human Evaluators - Laminar documentation
url:
description: How to use human evaluators in your evaluations.
language: en
---

[Skip to main content](https://docs.lmnr.ai/evaluations/human-evaluators#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Human Evaluators

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Use case: evaluating LLM-as-a-judge](https://docs.lmnr.ai/evaluations/human-evaluators#use-case%3A-evaluating-llm-as-a-judge)
- [When to use human evaluators](https://docs.lmnr.ai/evaluations/human-evaluators#when-to-use-human-evaluators)
- [How human evaluators work](https://docs.lmnr.ai/evaluations/human-evaluators#how-human-evaluators-work)
- [Basic usage](https://docs.lmnr.ai/evaluations/human-evaluators#basic-usage)
- [Validating LLM-as-a-judge evaluators](https://docs.lmnr.ai/evaluations/human-evaluators#validating-llm-as-a-judge-evaluators)
- [Analyzing judge performance](https://docs.lmnr.ai/evaluations/human-evaluators#analyzing-judge-performance)
- [Collecting human evaluator data into datasets](https://docs.lmnr.ai/evaluations/human-evaluators#collecting-human-evaluator-data-into-datasets)
- [Finding human evaluator spans](https://docs.lmnr.ai/evaluations/human-evaluators#finding-human-evaluator-spans)
- [Creating reference datasets from human scores](https://docs.lmnr.ai/evaluations/human-evaluators#creating-reference-datasets-from-human-scores)

Human evaluators enable you to incorporate human judgment into your evaluation pipeline. Unlike automated evaluators that provide immediate scores, human evaluators create evaluation tasks that require manual scoring through Laminar’s evaluation interface.

## [​](https://docs.lmnr.ai/evaluations/human-evaluators#use-case%3A-evaluating-llm-as-a-judge) Use case: evaluating LLM-as-a-judge

One of the most common use cases for human evaluators is **creating reference data to evaluate and calibrate LLM-as-a-judge evaluators**.When dealing with complex tasks that can’t be scored with simple code, you often need to prompt a strong reasoning LLM to act as an evaluator. However, you can’t assume your judge prompt is optimal and is aligned with human judgment. Human evaluators provide the ground truth needed to:

- **Validate LLM judge accuracy** \- Compare LLM scores against human expert judgment
- **Optimize judge prompts** \- Test different prompting strategies and select the best performing ones against human judgment

## [​](https://docs.lmnr.ai/evaluations/human-evaluators#when-to-use-human-evaluators) When to use human evaluators

Human evaluators are particularly valuable when:

- **Creating reference data for LLM judges** \- The primary use case for validating and improving automated LLM evaluators
- **Subjective quality assessment** \- Evaluating creativity, tone, or style where human judgment is essential
- **Domain expertise required** \- Evaluating specialized content that requires expert knowledge

## [​](https://docs.lmnr.ai/evaluations/human-evaluators#how-human-evaluators-work) How human evaluators work

When you include a `HumanEvaluator` in your evaluation:

1. **Evaluation runs normally** \- All automated evaluators execute immediately
2. **Human evaluation tasks created** \- Each datapoint generates a task requiring manual scoring
3. **Deferred scoring** \- Human evaluators appear as pending in the evaluation results
4. **Manual scoring through UI** \- Evaluators access the evaluation interface to assign scores
5. **Results integration** \- Human scores are incorporated into the overall evaluation metrics

## [​](https://docs.lmnr.ai/evaluations/human-evaluators#basic-usage) Basic usage

Here’s a simple example that combines automated and human evaluation.
We use code to check the story is under MAX_WORDS, and then use a human evaluator to get human assessment of the story quality.

Copy

```
from lmnr import evaluate, HumanEvaluator
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

def generate_story(data: dict) -> str:
    """Generate a creative story based on the prompt"""
    return client.chat.completions.create(
        model="gpt-4o",
        messages=[\
            {\
                "role": "user",\
                "content": f"Write a creative short story about: {data['prompt']}. Keep it under {data['max_words']} words."\
            }\
        ]
    ).choices[0].message.content

def check_length(output: str, target: dict) -> int:
    """Automated check the story is under MAX_WORDS"""
    return 1 if len(output.split()) <= target.get('max_words', 100) else 0

evaluate(
    data=[\
        {\
            "data": {\
                "prompt": "A robot learning to paint",\
                "max_words": 100\
            },\
            "target": {"max_words": 150},\
            "metadata": {\
                "title": "Robot Artist Story",\
                "category": "sci-fi"\
            }\
        },\
        {\
            "data": {\
                "prompt": "A time traveler's first day in medieval times",\
                "max_words": 100\
            },\
            "target": {"max_words": 150},\
            "metadata": {\
                "title": "Time Travel Adventure",\
                "category": "historical-fiction"\
            }\
        },\
    ],
    executor=generate_story,
    evaluators={
        "length_check": check_length,
        "story_quality": HumanEvaluator()
    },
)

```

After you run the evaluation, you’ll see the results in the dashboard. Notice how `story_quality` scores are pending, and `length_check` is completed.

![Human evaluator scores](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/human-evaluators/he-scores.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=ea51f5453008b28b3cf31b0fdaf4fa76)

When you click on a single evaluation run, you’ll see the human evaluator span. You can see the data that was sent to this human evaluator and manually score it.

![Human evaluator span](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/human-evaluators/he-span.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=62a22a699b393835505257f2d5878424)

After you score the human evaluator, you’ll see the scores in the dashboard.

![Human evaluator scores after](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/human-evaluators/he-scores-after.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=8dc4bde9056cc950472922c2ac09dd01)

## [​](https://docs.lmnr.ai/evaluations/human-evaluators#validating-llm-as-a-judge-evaluators) Validating LLM-as-a-judge evaluators

Here’s a practical example of using human evaluators to create reference data for validating and improving LLM-as-a-judge evaluators:

Copy

```
from lmnr import evaluate, HumanEvaluator
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

def generate_customer_response(data: dict) -> str:
    """Generate customer service responses"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[\
            {\
                "role": "system",\
                "content": "You are a helpful customer service representative."\
            },\
            {\
                "role": "user",\
                "content": data["customer_inquiry"]\
            }\
        ]
    )
    return response.choices[0].message.content

def llm_judge_helpfulness(output: str, target: dict) -> int:
    """LLM-as-a-judge evaluator for helpfulness (1-3 scale)"""
    response = client.chat.completions.create(
        model="o4-mini",
        messages=[\
            {\
                "role": "system",\
                "content": """Rate the helpfulness of this customer service response on a scale of 1-3:\
                1 = Not helpful at all\
                2 = Moderately helpful\
                3 = Very helpful\
\
                Consider: Does it address the customer's concern? Is it clear and actionable?\
                Respond with only the number."""\
            },\
            {\
                "role": "user",\
                "content": f"Customer inquiry: {target['customer_inquiry']}\n\nResponse: {output}"\
            }\
        ]
    )
    return int(response.choices[0].message.content.strip()) / 3

# Step 1: Create reference data with human evaluators
evaluate(
    data=[\
        {\
            "data": {"customer_inquiry": "My order hasn't arrived yet, it's been 2 weeks"},\
            "target": {"customer_inquiry": "My order hasn't arrived yet, it's been 2 weeks"}\
        },\
        {\
            "data": {"customer_inquiry": "I need to return a damaged product"},\
            "target": {"customer_inquiry": "I need to return a damaged product"}\
        },\
    ],
    executor=generate_customer_response,
    evaluators={
        "human_helpfulness": HumanEvaluator(),  # Creates reference scores
        "llm_judge_helpfulness": llm_judge_helpfulness,  # LLM judge to validate
    },
    group_name="llm_judge_calibration"
)

```

### [​](https://docs.lmnr.ai/evaluations/human-evaluators#analyzing-judge-performance) Analyzing judge performance

After collecting human reference scores, you can:

1. **Compare correlation** \- Measure how well LLM judge scores correlate with human scores
2. **Identify disagreements** \- Find cases where LLM and human scores differ significantly
3. **Iterate on prompts** \- Refine your judge prompt based on disagreement patterns

Let’s explore how to collect human evaluator data into datasets and use it to validate your LLM-as-a-judge evaluator.

### [​](https://docs.lmnr.ai/evaluations/human-evaluators#collecting-human-evaluator-data-into-datasets) Collecting human evaluator data into datasets

The [SQL Editor](https://docs.lmnr.ai/sql-editor/introduction) is a powerful tool for analyzing your human evaluator results and creating datasets for training or validating LLM-as-a-judge evaluators. Here’s how to leverage it:

### [​](https://docs.lmnr.ai/evaluations/human-evaluators#finding-human-evaluator-spans) Finding human evaluator spans

Human evaluator spans are stored with `span_type = 'HUMAN_EVALUATOR'` and can be identified by their evaluator name. Here’s a basic query to find all human evaluator spans in evaluation with certain id:

Copy

```
SELECT
    input,
    output
FROM spans
WHERE span_type = 'HUMAN_EVALUATOR'
  AND evaluation_id = '<evaluation_id>' -- Replace with your evaluation id
ORDER BY start_time DESC

```

### [​](https://docs.lmnr.ai/evaluations/human-evaluators#creating-reference-datasets-from-human-scores) Creating reference datasets from human scores

After running this query, click **“Export to Dataset”** to:

1. Create a new dataset or add to an existing one
2. Map the `input` to dataset `data` field
3. Map the `output` to dataset `target` field

Then you can use this dataset to run evaluation of your LLM-as-a-judge evaluator and use human score in `target` field as an expected score for the LLM-as-a-judge evaluator.

[Using Laminar datasets](https://docs.lmnr.ai/evaluations/using-dataset) [Configuration](https://docs.lmnr.ai/evaluations/configuration)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Human evaluator scores](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/human-evaluators/he-scores.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=29f22c06e854afdfa66bc75501fdace2)

![Human evaluator span](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/human-evaluators/he-span.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=a334df69fa925d65d0607acc753344f6)

![Human evaluator scores after](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/human-evaluators/he-scores-after.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=53a1898220d8fc32c4f94db626873fbf)
