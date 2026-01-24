---
title: Laminar Manual Evaluation - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/evaluations/manual-evaluation#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Laminar Manual Evaluation

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Manual vs. SDK Evaluation](https://docs.lmnr.ai/evaluations/manual-evaluation#manual-vs-sdk-evaluation)
- [How Manual Evaluation Works](https://docs.lmnr.ai/evaluations/manual-evaluation#how-manual-evaluation-works)
- [Quickstart](https://docs.lmnr.ai/evaluations/manual-evaluation#quickstart)
- [Step 1: Setup and Initialization](https://docs.lmnr.ai/evaluations/manual-evaluation#step-1%3A-setup-and-initialization)
- [Step 2: Create Your Executor and Evaluation logic](https://docs.lmnr.ai/evaluations/manual-evaluation#step-2%3A-create-your-executor-and-evaluation-logic)
- [Step 3: Create Evaluation and Datapoints](https://docs.lmnr.ai/evaluations/manual-evaluation#step-3%3A-create-evaluation-and-datapoints)
- [Complete Example](https://docs.lmnr.ai/evaluations/manual-evaluation#complete-example)
- [Evaluation Results](https://docs.lmnr.ai/evaluations/manual-evaluation#evaluation-results)
- [API Reference](https://docs.lmnr.ai/evaluations/manual-evaluation#api-reference)

The Laminar Manual Evaluation SDK and API provide you with **granular control** over the evaluation process, allowing you to integrate Laminar directly into your existing evaluation pipeline or create flexible and complex evaluation workflows.

## [​](https://docs.lmnr.ai/evaluations/manual-evaluation#manual-vs-sdk-evaluation) Manual vs. SDK Evaluation

Use manual evaluation when you need granular control over the evaluation lifecycle, custom tracing, or want to integrate evaluations with complex workflows.

The manual evaluation approach gives you fine-grained control over:

- **Step-by-step execution** tracking
- **Flexible evaluation logic** and scoring
- **Integration** with existing systems and workflows

## [​](https://docs.lmnr.ai/evaluations/manual-evaluation#how-manual-evaluation-works) How Manual Evaluation Works

Manual evaluation follows a structured workflow with three core components:

1. **Create Evaluation** \- Initialize a new evaluation
2. **Execute and Evaluate** \- Run your logic and evaluate it
   - Run your core logic
   - Run your evaluation logic

3. **Save and Update** \- Store datapoints and evaluation results

## [​](https://docs.lmnr.ai/evaluations/manual-evaluation#quickstart) Quickstart

Let’s walk through implementing manual evaluation with tracing, breaking down each component:

### [​](https://docs.lmnr.ai/evaluations/manual-evaluation#step-1%3A-setup-and-initialization) Step 1: Setup and Initialization

First, initialize Laminar and create your evaluation clients:

JavaScript

Python

Copy

```
import { Laminar, LaminarClient, observe } from "@lmnr-ai/lmnr";
import { OpenAI } from "openai";

Laminar.initialize({
    projectApiKey: 'your_project_api_key',
    instrumentModules: {
        openAI: OpenAI  // Automatically traces OpenAI calls
    }
});

const client = new LaminarClient({
    projectApiKey: 'your_project_api_key',
});

const openai = new OpenAI({ apiKey: 'your_openai_api_key' });

```

### [​](https://docs.lmnr.ai/evaluations/manual-evaluation#step-2%3A-create-your-executor-and-evaluation-logic) Step 2: Create Your Executor and Evaluation logic

- Our executor function makes a call to OpenAI and is wrapped with tracing:

JavaScript

Python

Copy

```
const executeTestCase = async (testCase) => {
    return await observe(
        { name: 'executor', spanType: 'EXECUTOR', input: testCase.data },
        async () => {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [\
                    {\
                        role: 'user',\
                        content: `What is the capital of ${testCase.data.country}? ` +\
                          'Answer only with the capital, no other text.'\
                    }\
                ]
            });
            return response.choices[0].message.content || '';
        }
    );
};

```

- Then our evaluator function `accuracy` is going to measure accuracy of executor.

JavaScript

Python

Copy

```
const accuracy = async (output, target) => {
    return await observe(
        { name: 'accuracy', spanType: 'EVALUATOR', input: { output, target } },
        async () => {
            if (!target) return 0;
            return output.includes(target) ? 1 : 0;
        }
    );
};

```

### [​](https://docs.lmnr.ai/evaluations/manual-evaluation#step-3%3A-create-evaluation-and-datapoints) Step 3: Create Evaluation and Datapoints

First, you need to create an evaluation session, then create datapoints with test data and update them with execution results and scores.**Create Evaluation**Before creating datapoints, you must initialize an evaluation session:

JavaScript

Python

Copy

```
const evalId = await client.evals.create({
    name: "Capital of Country Manual Eval",
    groupName: "Manual API - Capital Cities"
});

```

**Create/Update Datapoints**The most important aspect is connecting your evaluation datapoints to the current execution trace using `trace_id` / `traceId`.
This makes it possible to attach the created spans to a trace, which can then be inspected later in trace view.

You need to call `Laminar.getTraceId()` / `Laminar.get_trace_id()` inside of context of span to get id of trace.

We strongly advise to call `createDatapoint` / `create_datapoint` before calling executor/evaluator so trace can be associated as evaluation trace type.

JavaScript

Python

Copy

```
const datapointId = await client.evals.createDatapoint({
    evalId,
    data: testCase.data,
    target: testCase.target,
    index: i,
    // Must be called within span context
    traceId: Laminar.getTraceId(),
});

await client.evals.updateDatapoint({
    evalId,
    datapointId,
    scores: { accuracy: accuracyScore },
    executorOutput: {
        response: output,
        model: 'gpt-4o-mini',
        country: testCase.data.country
    },
});

```

## [​](https://docs.lmnr.ai/evaluations/manual-evaluation#complete-example) Complete Example

JavaScript

Python

Copy

```
import { Laminar, LaminarClient, observe } from "@lmnr-ai/lmnr";
import { OpenAI } from "openai";

Laminar.initialize({
    projectApiKey: 'your_project_api_key',
    instrumentModules: {
    openAI: OpenAI
    }
});

const client = new LaminarClient({
    projectApiKey: 'your_project_api_key',
});
const openai = new OpenAI({ apiKey: 'your_openai_api_key' });

const executeTestCase = async (testCase) => {
    return await observe(
        { name: 'executor', spanType: 'EXECUTOR', input: testCase.data },
        async () => {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [\
                    {\
                        role: 'user',\
                        content: `What is the capital of ${testCase.data.country}? ` +\
                          'Answer only with the capital, no other text.'\
                    }\
                ]
            });
            return response.choices[0].message.content || '';
        }
    );
};

const accuracy = async (output, target) => {
    return await observe(
        { name: 'accuracy', spanType: 'EVALUATOR', input: { output, target } },
        async () => {
            if (!target) return 0;
            return output.includes(target) ? 1 : 0;
        }
    );
};

async function runEvaluation() {
    try {
        const testData = [\
            {\
                data: { country: 'France' },\
                target: 'Paris',\
            },\
            {\
                data: { country: 'Germany' },\
                target: 'Berlin',\
            },\
        ];

        const evalId = await client.evals.create({
            name: "Capital of Country Manual Eval",
            groupName: "Manual API - Capital Cities"
        });

        for (let i = 0; i < testData.length; i++) {
            await observe(
                { name: 'evaluation', spanType: 'EVALUATION', input: { testCase: testData[i] } },
                async () => {
                    const testCase = testData[i];

                    // Save datapoint first to associate trace as evaluation type
                    const datapointId = await client.evals.createDatapoint({
                        evalId,
                        data: testCase.data,
                        target: testCase.target,
                        index: i,
                        // Must be called within span context
                        traceId: Laminar.getTraceId(),
                    });

                    const output = await executeTestCase(testCase);

                    const accuracyScore = await accuracy(output, testCase.target)

                    await client.evals.updateDatapoint({
                        evalId,
                        datapointId,
                        scores: { accuracy: accuracyScore },
                        executorOutput: {
                            response: output,
                            model: 'gpt-4o-mini',
                            country: testCase.data.country
                        },
                    });
                }
            );
        }

        await Laminar.flush();
    } catch (error) {
        console.error("Error:", error.message);
    }
}

runEvaluation();

```

See all 103 lines

## [​](https://docs.lmnr.ai/evaluations/manual-evaluation#evaluation-results) Evaluation Results

When you run the following example of manual evaluation, you’ll see detailed tracing and evaluation results in your Laminar dashboard:

![Manual evaluation results showing tracing hierarchy with evaluation, executor, and evaluator spans, along with datapoint scores and metadata](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/manual-evaluation.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=988df4183b96716a82365619b92d9b98)

## [​](https://docs.lmnr.ai/evaluations/manual-evaluation#api-reference) API Reference

For detailed API specifications including request/response schemas, visit:

[**Create Evaluation** \\
\\
Initialize a new evaluation session](https://docs.lmnr.ai/api-reference/evals/init_eval) [**Save Datapoints** \\
\\
Add evaluation datapoints with input data and expected outputs](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints) [**Update Datapoint** \\
\\
Update datapoint with execution results and scores](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint)

[SDK and CLI reference](https://docs.lmnr.ai/evaluations/reference) [Cookbook](https://docs.lmnr.ai/evaluations/cookbook)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Manual evaluation results showing tracing hierarchy with evaluation, executor, and evaluator spans, along with datapoint scores and metadata](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/manual-evaluation.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=95091a36f1851742202c74165fb0f672)
