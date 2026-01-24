---
title: Get started with Laminar evaluations - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/evaluations/quickstart#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Get started with Laminar evaluations

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Evaluation Lifecycle](https://docs.lmnr.ai/evaluations/quickstart#evaluation-lifecycle)
- [Evaluation function types](https://docs.lmnr.ai/evaluations/quickstart#evaluation-function-types)
- [Create your first evaluation](https://docs.lmnr.ai/evaluations/quickstart#create-your-first-evaluation)
- [Prerequisites](https://docs.lmnr.ai/evaluations/quickstart#prerequisites)
- [Create an evaluation file](https://docs.lmnr.ai/evaluations/quickstart#create-an-evaluation-file)
- [Run the evaluation](https://docs.lmnr.ai/evaluations/quickstart#run-the-evaluation)
- [Using the CLI](https://docs.lmnr.ai/evaluations/quickstart#using-the-cli)
- [Running as a standalone script](https://docs.lmnr.ai/evaluations/quickstart#running-as-a-standalone-script)
- [View evaluation results](https://docs.lmnr.ai/evaluations/quickstart#view-evaluation-results)
- [Tracking evaluation progress](https://docs.lmnr.ai/evaluations/quickstart#tracking-evaluation-progress)

This guide will walk you through running your first evaluation using Laminar’s evaluation system.Laminar provides a structured approach to create, run, and track your AI system’s performance through these key components:

- **Executors** \- Functions that process inputs and produce outputs, such as prompt templates, LLM calls, or production logic
- **Evaluators** \- Functions that assess outputs against targets or quality criteria, producing numeric scores
- **Datasets** \- Collections of datapoints (test cases) with 3 key elements:
  - `data` \- Required JSON input sent to the executor
  - `target` \- Optional reference data sent to the evaluator, typically containing expected outputs
  - `metadata` \- Optional metadata. This can be used to filter evaluation results in the UI after the evaluation is run.

- **Visualization** \- Tools to track performance trends and detect regressions over time
- **Tracing** \- Automatic recording of execution flow and model invocations

Example datapoint:

Copy

```
{
  "data": {
    "question": "What is the capital of France? Respond in one word.",
  },
  "target": {
    "answer": "Paris"
  },
  "metadata": {
    "category": "geography"
  }
}

```

**Evaluation Groups** group related evaluations to assess one feature or component, with results aggregated for comparison.

## [​](https://docs.lmnr.ai/evaluations/quickstart#evaluation-lifecycle) Evaluation Lifecycle

For each datapoint in a dataset:

1. The executor receives the `data` as input
2. The executor runs and its output is stored
3. Both the executor output and `target` are passed to the evaluator
4. The evaluator produces either a numeric score or a JSON object with multiple numeric scores
5. Results are stored and can be visualized to track performance over time

This approach helps you continuously measure your AI system’s performance as you make changes, showing the impact of model updates, prompt revisions, and code changes.

### [​](https://docs.lmnr.ai/evaluations/quickstart#evaluation-function-types) Evaluation function types

Each executor takes in the `data` as it is defined in the datapoints.
Evaluator accepts the output of the executor as its first argument,
and `target` as it’s defined in the datapoints as the second argument.This means that the type of the `data` fields in your datapoints must
match the type of the first parameter of the executor function. Similarly,
the type of the `target` fields in your datapoints must match the type of
the second parameter of the evaluator function(s).Python is a bit more permissive. If you see type errors in TypeScript,
make sure the data types and the parameter types match.For a more precise description, here’s the partial TypeScript type signature of the `evaluate` function:

Copy

```
evaluate<D, T, O>(
  data: {
    data: D,
    target?: T,
  },
  executor: (data: D, ...args: any[]) => O | Promise<O>;
  evaluators: {
    [key: string]: (output: O, target?: T, ...args: any[]) =>
      number | { [key: string]: number }
  },
  // ... other parameters
)

```

See full reference [here](https://docs.lmnr.ai/evaluations/reference#typescript-evaluation-types).

## [​](https://docs.lmnr.ai/evaluations/quickstart#create-your-first-evaluation) Create your first evaluation

### [​](https://docs.lmnr.ai/evaluations/quickstart#prerequisites) Prerequisites

To get the project API key, go to the Laminar dashboard, click the project settings,
and generate a project API key. This is available both in the cloud and in the self-hosted version of Laminar.Specify the key at `Laminar` initialization. If not specified,
Laminar will look for the key in the `LMNR_PROJECT_API_KEY` environment variable.

### [​](https://docs.lmnr.ai/evaluations/quickstart#create-an-evaluation-file) Create an evaluation file

- TypeScript

- Python

Create a file named `my-first-evaluation.ts` and add the following code:

my-first-evaluation.ts

Copy

```
import { evaluate } from '@lmnr-ai/lmnr';
import { OpenAI } from 'openai';

const client = new OpenAI();

const capitalOfCountry = async (data: {country: string}) => {
  // replace this with your LLM call or custom logic
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [\
      {\
        role: 'user',\
        content: `What is the capital of ${data['country']}? ` +\
          'Answer only with the capital, no other text.'\
      }\
    ]
  });
  return response.choices[0].message.content || '';
}

evaluate({
  data: [\
    {\
      data: { country: 'France' },\
      target: 'Paris',\
    },\
    {\
      data: { country: 'Germany' },\
      target: 'Berlin',\
    },\
  ],
  executor: capitalOfCountry,
  evaluators: {
    accuracy: (output: string, target: string | undefined): number => {
      if (!target) return 0;
      return output.includes(target) ? 1 : 0;
    }
  },
  config: {
    instrumentModules: {
      openAI: OpenAI
    }
  }
})

```

It is important to pass the `config` object with `instrumentModules` to `evaluate` to ensure that the OpenAI client and any other instrumented modules are instrumented.

### [​](https://docs.lmnr.ai/evaluations/quickstart#run-the-evaluation) Run the evaluation

You can run evaluations in two ways: using the `lmnr eval` CLI or directly executing the evaluation file.

#### [​](https://docs.lmnr.ai/evaluations/quickstart#using-the-cli) Using the CLI

The Laminar CLI automatically detects top-level `evaluate` function calls in your files - you don’t need to wrap them in a `main` function or any special structure.

- TypeScript

- Python

Copy

```
export LMNR_PROJECT_API_KEY=<YOUR_PROJECT_API_KEY>
npx lmnr eval my-first-evaluation.ts

```

To run multiple evaluations, place them in an `evals` directory with the naming pattern `*.eval.{ts,js}`:

Copy

```
├─ src/
├─ evals/
│  ├── my-first-evaluation.eval.ts
│  ├── my-second-evaluation.eval.ts
│  ├── ...

```

Then run all evaluations with a single command:

Copy

```
npx lmnr eval

```

#### [​](https://docs.lmnr.ai/evaluations/quickstart#running-as-a-standalone-script) Running as a standalone script

You can also import and call `evaluate` directly from your application code:

- TypeScript

- Python

Copy

```
ts-node my-first-evaluation.ts
# or
npx tsx my-first-evaluation.ts

```

The `evaluate` function is flexible and can be used both in standalone scripts processed by the CLI and integrated directly into your application code.

Evaluator functions must return either a single numeric score or a JSON object where each key is a score name and the value is a numeric score.

No need to initialize Laminar - `evaluate` automatically initializes Laminar behind the scenes. All instrumented function calls and model invocations are traced without any additional setup.

### [​](https://docs.lmnr.ai/evaluations/quickstart#view-evaluation-results) View evaluation results

When you run an evaluation from the CLI, Laminar will output the link to the dashboard where you can view the evaluation results.Laminar stores every evaluation result. A run for every datapoint is represented as a trace. You can view the results and corresponding traces in the evaluations page.

![Example evaluation](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/simple-eval-example.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=1864f7eda839ee6b67b97a3ab4643313)

## [​](https://docs.lmnr.ai/evaluations/quickstart#tracking-evaluation-progress) Tracking evaluation progress

To track the score progression over time or compare evaluations side-by-side, you need to group them together. This can be achieved by passing the `groupName` parameter to the `evaluate` function.

- TypeScript

- Python

Copy

```
import { evaluate, LaminarDataset } from '@lmnr-ai/lmnr';

evaluate({
    data: new LaminarDataset("name_of_your_dataset"),
    executor: yourExecutorFunction,
    evaluators: {evaluatorName: yourEvaluator},
    groupName: "evals_group_1",
});

```

![Example evaluation progression](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/eval-progress.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=0fd0d49ab952dc527b595f518c1691b6)

[Introduction](https://docs.lmnr.ai/evaluations/introduction) [Using Laminar datasets](https://docs.lmnr.ai/evaluations/using-dataset)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Example evaluation](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/simple-eval-example.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=4ca63c50c2bf0cec44f427b272dbe366)

![Example evaluation progression](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/eval-progress.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=c4c7f1d1dbb2d0bc453b5cb3463659c0)
