---
title: Introduction to Laminar datasets - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/datasets/introduction#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Datasets

Introduction to Laminar datasets

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Concept](https://docs.lmnr.ai/datasets/introduction#concept)
- [Format](https://docs.lmnr.ai/datasets/introduction#format)
- [Example](https://docs.lmnr.ai/datasets/introduction#example)
- [Use case: Evaluations](https://docs.lmnr.ai/datasets/introduction#use-case%3A-evaluations)
- [Editing](https://docs.lmnr.ai/datasets/introduction#editing)

## [​](https://docs.lmnr.ai/datasets/introduction#concept) Concept

Dataset is a collection of datapoints. It can be used for the following purposes:

1. Data storage for use in future fine-tuning or prompt-tuning.
2. Provide inputs and expected outputs for [Evaluations](https://docs.lmnr.ai/evaluations/introduction).

## [​](https://docs.lmnr.ai/datasets/introduction#format) Format

Every datapoint has two fixed JSON objects: `data` and `target`, each with arbitrary keys.
`target` is only used in evaluations.

- `data` – the actual datapoint data,
- `target` – data additionally sent to the evaluator function.
- `metadata` – arbitrary key-value metadata about the datapoint.

For every key inside `data` and `target`, the value can be any JSON value.

### [​](https://docs.lmnr.ai/datasets/introduction#example) Example

This is an example of a valid datapoint.

Copy

```
{
    "data": {
        "color": "red",
        "size": "large",
        "messages": [\
            {\
                "role": "user",\
                "content": "Hello, can you help me choose a T-shirt?"\
            },\
            {\
                "role": "assistant",\
                "content": "I'm afraid, we don't sell T-shirts"\
            }\
        ]
    },
    "target": {
        "expected_output": "Of course! What size and color are you looking for?"
    }
}

```

## [​](https://docs.lmnr.ai/datasets/introduction#use-case%3A-evaluations) Use case: Evaluations

Datasets can be used for evaluations to specify inputs and expected outputs.You will need to make sure the dataset keys match the input and output node names of the pipelines.
See more in the [Evaluations](https://docs.lmnr.ai/evaluations/introduction) page.

## [​](https://docs.lmnr.ai/datasets/introduction#editing) Editing

Datasets are editable. You can edit the datapoints by clicking on the datapoint and
editing the data in JSON. The changes are saved automatically.

[Overview](https://docs.lmnr.ai/custom-dashboards/overview) [Adding data](https://docs.lmnr.ai/datasets/adding-data)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
