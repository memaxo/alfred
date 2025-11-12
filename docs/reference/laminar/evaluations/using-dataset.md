---
title: Using dataset stored on Laminar for evaluations - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/using-dataset#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Using dataset stored on Laminar for evaluations

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Prerequisites](https://docs.lmnr.ai/evaluations/using-dataset#prerequisites)
- [Defining data](https://docs.lmnr.ai/evaluations/using-dataset#defining-data)
- [Technical details and extension](https://docs.lmnr.ai/evaluations/using-dataset#technical-details-and-extension)

## [​](https://docs.lmnr.ai/evaluations/using-dataset\#prerequisites)  Prerequisites

Have a dataset uploaded to Laminar, or collected from traces. See [datasets](https://docs.lmnr.ai/datasets/introduction) for more information.

## [​](https://docs.lmnr.ai/evaluations/using-dataset\#defining-data)  Defining data

To run an evaluation with a Laminar dataset, you pass the dataset object as `data` instead of a list of dictionaries.Use `LaminarDataset` to create a dataset object. The dataset name should match the name of the dataset in Laminar.
The constructor also takes an optional `fetch_size`/ `fetchSize` parameter, which specifies the number of datapoints to fetch at once.
The default value is 25. We strongly recommend setting this value to a number that is a multiple of the
evaluation [batch size](https://docs.lmnr.ai/evaluations/configuration#configuring-evaluations) for best performance.

- JavaScript/TypeScript

- Python


Copy

```
import { evaluate, LaminarDataset } from '@lmnr-ai/lmnr';
const data = new LaminarDataset("name_of_your_dataset");
evaluate({
    data,
    executor: yourExecutorFunction,
    evaluators: yourEvaluators,
    config: {
        projectApiKey: process.env.LMNR_PROJECT_API_KEY,
        // ... other optional parameters
    }
})

```

## [​](https://docs.lmnr.ai/evaluations/using-dataset\#technical-details-and-extension)  Technical details and extension

`LaminarDataset` is an implementation of an abstract class `EvaluationDataset` which defines 2 methods besides initialization:

- `__len__` ( `size` in JS): Returns the number of datapoints in the dataset.
- `__getitem__` ( `get` in JS): Returns a single datapoint by index.

We also implement a concrete `slice` method to make slicing easier than using `__getitem__` directly.This is inspired by the PyTorch [`Dataset` class](https://pytorch.org/tutorials/beginner/basics/data_tutorial.html#creating-a-custom-dataset-for-your-files),
and is designed to be used in a similar way.You can re-use the `EvaluationDataset` class to create your own dataset classes, for example, to fetch data from a database or an API.

- JavaScript/TypeScript

- Python


Copy

```
import { EvaluationDataset } from '@lmnr-ai/lmnr';

class MyCustomDataset extends EvaluationDataset {
    constructor(customProperty) {
        super();
        // Your custom initialization code here
    }

    public async size() {
        // Your custom implementation here
        return 0;
    }

    public async get(index: number) {
        // Your custom implementation here
        return { data: {}, target: {} };
    }

    // Optionally, you can implement other custom methods here
}

```

[Quickstart](https://docs.lmnr.ai/evaluations/quickstart) [Human Evaluators](https://docs.lmnr.ai/evaluations/human-evaluators)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.