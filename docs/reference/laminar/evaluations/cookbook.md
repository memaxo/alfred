---
title: Laminar evaluations cookbook - Laminar documentation
url: 
description: Examples of evaluations in Laminar
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/cookbook#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Laminar evaluations cookbook

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Basic correctness evaluation](https://docs.lmnr.ai/evaluations/cookbook#basic-correctness-evaluation)
- [LLM as a judge offline evaluation](https://docs.lmnr.ai/evaluations/cookbook#llm-as-a-judge-offline-evaluation)
- [Evaluation with no target](https://docs.lmnr.ai/evaluations/cookbook#evaluation-with-no-target)

## [​](https://docs.lmnr.ai/evaluations/cookbook\#basic-correctness-evaluation)  Basic correctness evaluation

In this example our executor function calls an LLM to get the capital of a country.
We then evaluate the correctness of the prediction by checking for exact match with the target capital.

1

1\. Define an executor function

The executor function calls OpenAI to get the capital of a country.
The prompt also asks to only name the city and nothing else. In a real scenario,
you will likely want to use structured output to get the city name only.

- JavaScript/TypeScript

- Python


Copy

```
import OpenAI from 'openai';

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

const getCapital = async (
    {country}: {country: string}
): Promise<string> => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [\
            {\
                role: 'system',\
                content: 'You are a helpful assistant.'\
            }, {\
                role: 'user',\
                content: `What is the capital of ${country}?` +\
                ' Just name the city and nothing else'\
            }\
        ],
    });
    return response.choices[0].message.content ?? ''
}

```

2

2\. Define an evaluator function

The evaluator function checks for exact match and returns 1 if the executor output
matches the target, and 0 otherwise.

- JavaScript/TypeScript

- Python


Copy

```
const evaluator = async (output: Promise<string>, target?: {capital: string}) =>
    (await output) === target?.capital ? 1 : 0

```

3

3\. Define data and run the evaluation

- JavaScript/TypeScript

- Python


my-eval.ts

Copy

```
import { evaluate } from '@lmnr-ai/lmnr';

const evaluationData = [\
    { data: { country: 'Canada' }, target: { capital: 'Ottawa' } },\
    { data: { country: 'Germany' }, target: { capital: 'Berlin' } },\
    { data: { country: 'Tanzania' }, target: { capital: 'Dodoma' } },\
]

evaluate({
    data: evaluationData,
    executor: async (data) => await getCapital(data),
    evaluators: { checkCapitalCorrectness: evaluator },
    config: {
        projectApiKey: process.env.LMNR_PROJECT_API_KEY
    }
})

```

And then run either `ts-node my-eval.ts` or `npx lmnr eval my-eval.ts`.

## [​](https://docs.lmnr.ai/evaluations/cookbook\#llm-as-a-judge-offline-evaluation)  LLM as a judge offline evaluation

In this example, our executor will write short summaries of news articles,
and the evaluator will check if the summary is correct, and grade them from 1 to 5.

1

1\. Prepare your data

The trick here is that the evaluator function needs to see the original article to evaluate the summary.
That is why, we will have to duplicate the article from `data` into `target` prior to running the evaluation.The data may look something like the following:

Copy

```
[\
    {\
        "data": {\
            "article": "Laminar has released a new feature. ...",\
        },\
        "target": {\
            "article": "Laminar has released a new feature. ...",\
        }\
    }\
]

```

2

2\. Define an executor function

An executor function calls OpenAI to summarize a news article. It returns a single string, the summary.

- JavaScript/TypeScript

- Python


Copy

```
import OpenAI from 'openai';

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

const getSummary = async (data: {article: string}): Promise<string> => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [\
            {\
                role: "system",\
                content: "Summarize the articles that the user sends you"\
            }, {\
                role: "user",\
                content: data.article,\
            },\
        ],
    });
    return response.choices[0].message.content ?? ''
}

```

3

3\. Define an evaluator function

An evaluator function grades the summary from 1 to 5. It returns an integer.
We’ve simply asked OpenAI to respond in JSON, but you may want to use
structured output or BAML instead.We also ask the LLM to give a comment on the summary. Even though we don’t use it in the evaluation,
it may be useful for debugging or further analysis. In addition, LLMs are known to perform better
when given a chance to explain their reasoning.

- JavaScript/TypeScript

- Python


Copy

```
import OpenAI from 'openai';

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

const gradeSummary = async (
    summary: string,
    data: {article: string}
): Promise<number> => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{\
            role: "user",\
            content: "Given an article and its summary, grade the " +\
                "summary from 1 to 5. Answer in json. For example: " +\
                '{"grade": 3, "comment": "Summary is missing key points"}' +\
                `Article: ${target['article']}. Summary: ${summary}`\
        }],
    });
    return JSON.parse(response.choices[0].message.content ?? '')["grade"]
}

```

4

4\. Run the evaluation

- JavaScript/TypeScript

- Python


my-eval.ts

Copy

```
import { evaluate } from '@lmnr-ai/lmnr';

const evaluationData = [\
    { data: { article: '...' }, target: { article: '...' } },\
    { data: { article: '...' }, target: { article: '...' } },\
    { data: { article: '...' }, target: { article: '...' } },\
]

evaluate({
    data: evaluationData,
    executor: async (data) => await getSummary(data),
    evaluators: { gradeSummary: gradeSummary },
    config: {
        projectApiKey: process.env.LMNR_PROJECT_API_KEY
    }
})

```

And then run either `ts-node my-eval.ts` or `npx lmnr eval my-eval.ts`.

## [​](https://docs.lmnr.ai/evaluations/cookbook\#evaluation-with-no-target)  Evaluation with no target

Sometimes you may want to run evaluations on the output of the executor without a target.
This can be useful, for example, to check if the output of the executor is in the correct format
or if you want to use an LLM as a judge evaluator that generally evaluates the output.

- JavaScript/TypeScript

- Python


This is as simple as not passing `target` to your evaluator functions.

Copy

```
function isOutputLongEnough(output) {
    return output.length > 100 ? 1 : 0
}

```

And for your dataset, you can just remove the `target` field. For example:

Copy

```
[\
    { "data": { "article": "..." } },\
    { "data": { "article": "..." } },\
    { "data": { "article": "..." } },\
]

```

[Manual Evaluation](https://docs.lmnr.ai/evaluations/manual-evaluation) [Introduction](https://docs.lmnr.ai/evaluations/online-evaluators/introduction)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.