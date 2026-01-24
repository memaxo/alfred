---
title: Table Schemas for SQL Editor - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/sql-editor/reference#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

SQL Editor

Table Schemas for SQL Editor

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Table schemas and enum types](https://docs.lmnr.ai/sql-editor/reference#table-schemas-and-enum-types)
- [spans](https://docs.lmnr.ai/sql-editor/reference#spans)
- [Path](https://docs.lmnr.ai/sql-editor/reference#path)
- [Parent span ID](https://docs.lmnr.ai/sql-editor/reference#parent-span-id)
- [Span type](https://docs.lmnr.ai/sql-editor/reference#span-type)
- [Input and output](https://docs.lmnr.ai/sql-editor/reference#input-and-output)
- [Attributes](https://docs.lmnr.ai/sql-editor/reference#attributes)
- [Model](https://docs.lmnr.ai/sql-editor/reference#model)
- [Total tokens and total cost](https://docs.lmnr.ai/sql-editor/reference#total-tokens-and-total-cost)
- [traces](https://docs.lmnr.ai/sql-editor/reference#traces)
- [Trace type](https://docs.lmnr.ai/sql-editor/reference#trace-type)
- [Duration](https://docs.lmnr.ai/sql-editor/reference#duration)
- [Status](https://docs.lmnr.ai/sql-editor/reference#status)
- [Metadata](https://docs.lmnr.ai/sql-editor/reference#metadata)
- [events](https://docs.lmnr.ai/sql-editor/reference#events)
- [Notes](https://docs.lmnr.ai/sql-editor/reference#notes)
- [evaluation_datapoints](https://docs.lmnr.ai/sql-editor/reference#evaluation-datapoints)
- [evaluation_scores](https://docs.lmnr.ai/sql-editor/reference#evaluation-scores)
- [Best practices](https://docs.lmnr.ai/sql-editor/reference#best-practices)
- [Avoid joins](https://docs.lmnr.ai/sql-editor/reference#avoid-joins)
- [Solution](https://docs.lmnr.ai/sql-editor/reference#solution)
- [Add start_time filter](https://docs.lmnr.ai/sql-editor/reference#add-start-time-filter)
- [Searching in span input or output](https://docs.lmnr.ai/sql-editor/reference#searching-in-span-input-or-output)
- [Example](https://docs.lmnr.ai/sql-editor/reference#example)

This page contains a reference of the table schemas and Laminar-specific syntax.

## [​](https://docs.lmnr.ai/sql-editor/reference#table-schemas-and-enum-types) Table schemas and enum types

This section contains subsets of the table schemas and enumerated types (enums) that are relevant to the SQL Editor.

### [​](https://docs.lmnr.ai/sql-editor/reference#spans) spans

| Column           | Type         | Example value                                                                   |
| ---------------- | ------------ | ------------------------------------------------------------------------------- |
| `span_id`        | `UUID`       | `"00000000-0000-0000-1234-426614174000"`                                        |
| `status`         | `String`     | `"error"`                                                                       |
| `name`           | `String`     | `"openai.chat"`                                                                 |
| `path`           | `String`     | `"workflow.process.step1.openai.chat"`                                          |
| `trace_id`       | `UUID`       | `"12345678-90ab-cdef-1234-426614174000"`                                        |
| `parent_span_id` | `UUID`       | `"00000000-0000-0000-a456-abcd5667ef09"`                                        |
| `span_type`      | `UInt8`      | `1`                                                                             |
| `start_time`     | `DateTime64` | `"2021-01-01 00:00:00+00"`                                                      |
| `end_time`       | `DateTime64` | `"2021-01-01 00:00:00+00"`                                                      |
| `input`          | `String`     | `"[{\"role\": \"user\", \"content\": \"Hello, world!\"}]"`                      |
| `output`         | `String`     | `"[{\"role\": \"assistant\", \"content\": \"Hi! How can I help you today?\"}]"` |
| `attributes`     | `String`     | `"{\"gen_ai.system\": \"openai\", \"gen_ai.model\": \"gpt-4o\"}"`               |
| `request_model`  | `String`     | `"gpt-4.1-mini"`                                                                |
| `response_model` | `String`     | `"gpt-4.1-mini-2025-04-14"`                                                     |
| `model`          | `String`     | `"gpt-4.1-mini-2025-04-14"`                                                     |
| `provider`       | `String`     | `"openai"`                                                                      |
| `input_tokens`   | `UInt64`     | `150`                                                                           |
| `output_tokens`  | `UInt64`     | `100`                                                                           |
| `total_tokens`   | `UInt64`     | `250`                                                                           |
| `total_cost`     | `Float64`    | `0.6897`                                                                        |
| `input_cost`     | `Float64`    | `0.5667`                                                                        |
| `output_cost`    | `Float64`    | `0.123`                                                                         |

#### [​](https://docs.lmnr.ai/sql-editor/reference#path) Path

Laminar span path is stored as an array of span names in span attributes. However, in the SQL queries,
it is stored as a string with items joined by a dot.For example, if the span path is `["outer", "inner"]`, the `path` column will be `"outer.inner"`.If needed, you can still access the array value by accessing the `attributes` using `simpleJSONExtractRaw(attributes, 'lmnr.span.path')`.

#### [​](https://docs.lmnr.ai/sql-editor/reference#parent-span-id) Parent span ID

If the current span is the top span of the trace, the `parent_span_id` will be a 0 UUID, i.e. `"00000000-0000-0000-0000-000000000000"`.

#### [​](https://docs.lmnr.ai/sql-editor/reference#span-type) Span type

Here are the values of the `span_type` column and their meanings:

Copy

```
0: Default
1: LLM
3: Executor
4: Evaluator
5: Evaluation
6: Tool
7: HumanEvaluator

```

#### [​](https://docs.lmnr.ai/sql-editor/reference#input-and-output) Input and output

The `input` and `output` columns are stored as either raw strings or stringified JSONs. The best way to parse them is to try
to parse them as JSON, and if it fails, use the raw string. You can also use `isValidJSON` [function](https://clickhouse.com/docs/sql-reference/functions/json-functions#isvalidjson) right in the query to test for this.`input` and `output` columns are also indexed on content, so you can use them in WHERE conditions. Use `ILIKE` instead of `LIKE`, because the index is case-insensitive.

#### [​](https://docs.lmnr.ai/sql-editor/reference#attributes) Attributes

The `attributes` column is stored as a string in JSON format. That is, you can safely `JSON.parse` / `json.loads` them. In addition,
you can use JSON\* and simpleJSON\* functions on them right in the queries. Attributes are guaranteed to be a valid JSON object.

#### [​](https://docs.lmnr.ai/sql-editor/reference#model) Model

The `model` column is set to the response model if present, otherwise it is set to the request model.

#### [​](https://docs.lmnr.ai/sql-editor/reference#total-tokens-and-total-cost) Total tokens and total cost

Usually, the `total_tokens = input_tokens + output_tokens` and `total_cost = input_cost + output_cost`.However, you can manually report these values using the relevant attributes. In this case, totals may
not be equal to the sum of the input and output tokens and costs.

### [​](https://docs.lmnr.ai/sql-editor/reference#traces) traces

| Column          | Type         | Example value                            |
| --------------- | ------------ | ---------------------------------------- |
| `trace_id`      | `UUID`       | `"01234567-1234-cdef-1234-426614174000"` |
| `trace_type`    | `UInt8`      | `0`                                      |
| `start_time`    | `DateTime64` | `"2021-01-01 00:00:00+00"`               |
| `end_time`      | `DateTime64` | `"2021-01-01 00:00:00+00"`               |
| `duration`      | `Float64`    | `1.23`                                   |
| `input_tokens`  | `UInt64`     | `150`                                    |
| `output_tokens` | `UInt64`     | `100`                                    |
| `total_tokens`  | `UInt64`     | `250`                                    |
| `total_cost`    | `Float64`    | `0.6897`                                 |
| `input_cost`    | `Float64`    | `0.5667`                                 |
| `output_cost`   | `Float64`    | `0.123`                                  |
| `status`        | `String`     | `"error"`                                |
| `user_id`       | `String`     | `"user_123"`                             |
| `session_id`    | `String`     | `"session_123"`                          |
| `metadata`      | `String`     | `"{\"key\": \"value\"}"`                 |
| `top_span_id`   | `UUID`       | `"00000000-0000-0000-1234-426614174000"` |

#### [​](https://docs.lmnr.ai/sql-editor/reference#trace-type) Trace type

Here are the values of the `trace_type` column and their meanings:

Copy

```
0: Default
2: Evaluation
3: Playground

```

#### [​](https://docs.lmnr.ai/sql-editor/reference#duration) Duration

The duration is in seconds, and is calculated as `end_time - start_time`.

#### [​](https://docs.lmnr.ai/sql-editor/reference#status) Status

Status is set to error if any of the spans in the trace have status `error`. Empty status means success.

#### [​](https://docs.lmnr.ai/sql-editor/reference#metadata) Metadata

Metadata is stored as a string in JSON format. That is, you can safely `JSON.parse` / `json.loads` it. In addition,
you can use JSON\* and simpleJSON\* functions on it right in the queries. Metadata is guaranteed to be a valid JSON object.

### [​](https://docs.lmnr.ai/sql-editor/reference#events) events

| Column       | Type       | Example value                            |
| ------------ | ---------- | ---------------------------------------- |
| `id`         | `UUID`     | `"01234567-89ab-4def-1234-426614174000"` |
| `span_id`    | `UUID`     | `"00000000-0000-0000-1234-426614174000"` |
| `name`       | `String`   | `"My custom event"`                      |
| `timestamp`  | `DateTime` | `"2021-01-01 00:00:00+00"`               |
| `attributes` | `String`   | `"{\"key\": \"value\"}"`                 |
| `user_id`    | `String`   | `"user_123"`                             |
| `session_id` | `String`   | `"session_123"`                          |

#### [​](https://docs.lmnr.ai/sql-editor/reference#notes) Notes

**Attributes**The `attributes` column is stored as a string in JSON format. That is, you can safely `JSON.parse` / `json.loads` it. In addition,
you can use JSON\* and simpleJSON\* functions on it right in the queries. Attributes are guaranteed to be a valid JSON object.

### [​](https://docs.lmnr.ai/sql-editor/reference#evaluation-datapoints) evaluation_datapoints

| Column          | Type         | Example value                            |
| --------------- | ------------ | ---------------------------------------- |
| `id`            | `UUID`       | `"01234567-89ab-4def-1234-426614174000"` |
| `trace_id`      | `UUID`       | `"01234567-1234-cdef-1234-426614174000"` |
| `evaluation_id` | `UUID`       | `"98765432-1098-4654-3210-987654321098"` |
| `created_at`    | `DateTime64` | `"2021-01-01 00:00:00+00"`               |
| `data`          | `String`     | `"{\"key\": \"value\"}"`                 |
| `target`        | `String`     | `"{\"key\": \"value\"}"`                 |
| `metadata`      | `String`     | `"{\"key\": \"value\"}"`                 |
| `index`         | `UInt64`     | `0`                                      |

### [​](https://docs.lmnr.ai/sql-editor/reference#evaluation-scores) evaluation_scores

Evaluation scores are stored in a separate table, linked to the evaluation datapoints.The scores are flattened into a single row per score. For example, if your evaluation has 3 scores,
`{ "score1": 0.85, "score2": 0.90, "score3": 0.95 }` will be stored as 3 rows in the `evaluation_scores` table.

| Column                    | Type         | Example value                            |
| ------------------------- | ------------ | ---------------------------------------- |
| `evaluation_id`           | `UUID`       | `"01234567-89ab-cdef-1234-426614174000"` |
| `evaluation_datapoint_id` | `UUID`       | `"98765432-1098-7654-3210-987654321098"` |
| `timestamp`               | `DateTime64` | `"2021-01-01 00:00:00+00"`               |
| `name`                    | `String`     | `"My custom score"`                      |
| `value`                   | `Float64`    | `0.85`                                   |
| `metadata`                | `String`     | `"{\"key\": \"value\"}"`                 |
| `trace_id`                | `UUID`       | `"01234567-89ab-cdef-1234-426614174000"` |

## [​](https://docs.lmnr.ai/sql-editor/reference#best-practices) Best practices

### [​](https://docs.lmnr.ai/sql-editor/reference#avoid-joins) Avoid joins

ClickHouse is a columnar database, so, while JOINs are supported, they are not efficient.If you are joining tables with more than a few hundred rows, the query will likely timeout or fail.

#### [​](https://docs.lmnr.ai/sql-editor/reference#solution) Solution

Query the data you need, and join the relevant data in your application.

### [​](https://docs.lmnr.ai/sql-editor/reference#add-start-time-filter) Add start_time filter

You almost certainly want to add a `start_time` filter to your query.Spans table (and thus `traces` aggregation on it) is sorted by `start_time` and `trace_id`, so if you
apply a `start_time` WHERE condition, the query will run faster.Advantages:

- Queries run faster
- Queries will never fail because of running out of memory

### [​](https://docs.lmnr.ai/sql-editor/reference#searching-in-span-input-or-output) Searching in span input or output

You can search in the `input` and `output` columns of the `spans` table.
The search is optimized to be case-insensitive, so use `ILIKE` instead of `LIKE`.

#### [​](https://docs.lmnr.ai/sql-editor/reference#example) Example

Copy

```
SELECT name, input, output
FROM spans
WHERE input ILIKE '%france%' AND output ILIKE '%paris%'

```

[Overview](https://docs.lmnr.ai/sql-editor/overview) [Overview](https://docs.lmnr.ai/custom-dashboards/overview)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
