---
title: Overview of Laminar SQL syntax and approach - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/sql-editor/overview#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

SQL Editor

Overview of Laminar SQL syntax and approach

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Introduction](https://docs.lmnr.ai/sql-editor/overview#introduction)
- [Basic query structure](https://docs.lmnr.ai/sql-editor/overview#basic-query-structure)
- [Data types](https://docs.lmnr.ai/sql-editor/overview#data-types)
- [JSON](https://docs.lmnr.ai/sql-editor/overview#json)
- [Filtering by start_time](https://docs.lmnr.ai/sql-editor/overview#filtering-by-start-time)
- [Example](https://docs.lmnr.ai/sql-editor/overview#example)
- [Avoiding joins](https://docs.lmnr.ai/sql-editor/overview#avoiding-joins)
- [Example](https://docs.lmnr.ai/sql-editor/overview#example-2)
- [Working with dates](https://docs.lmnr.ai/sql-editor/overview#working-with-dates)
- [Truncating datetimes](https://docs.lmnr.ai/sql-editor/overview#truncating-datetimes)
- [Working with JSON](https://docs.lmnr.ai/sql-editor/overview#working-with-json)
- [Extracting values from JSON by key](https://docs.lmnr.ai/sql-editor/overview#extracting-values-from-json-by-key)
- [Checking if a key exists](https://docs.lmnr.ai/sql-editor/overview#checking-if-a-key-exists)
- [Nested extraction by key](https://docs.lmnr.ai/sql-editor/overview#nested-extraction-by-key)
- [More complex JSON functions](https://docs.lmnr.ai/sql-editor/overview#more-complex-json-functions)

## [​](https://docs.lmnr.ai/sql-editor/overview#introduction) Introduction

Laminar stores all queryable data in Clickhouse. Clickhouse is an analytical columnar database which provides a SQL-like query language.This guide will explain the SQL syntax used in Laminar SQL Editor. For the full Clickhouse SQL reference, see the [Clickhouse documentation](https://clickhouse.com/docs/sql-reference).

## [​](https://docs.lmnr.ai/sql-editor/overview#basic-query-structure) Basic query structure

We only allow `SELECT` queries, so we will focus on the syntax for this.Here’s the basic syntax of a Clickhouse `SELECT` query. Some parts that we don’t recommend or don’t support are omitted.

Copy

```
[WITH expr_list(subquery)]
SELECT [DISTINCT [ON (column1, column2, ...)]] expr_list
[FROM [db.]table | (subquery) | table_function] [FINAL]
[SAMPLE sample_coeff]
[ARRAY JOIN ...]
[PREWHERE expr]
[WHERE expr]
[GROUP BY expr_list] [WITH ROLLUP|WITH CUBE] [WITH TOTALS]
[HAVING expr]
[WINDOW window_expr_list]
[QUALIFY expr]
[ORDER BY expr_list]
  [WITH FILL] [FROM expr] [TO expr] [STEP expr] [INTERPOLATE [(expr_list)]]
[LIMIT [offset_value, ]n BY columns]
[LIMIT [n, ]m] [WITH TIES]

```

The very basics are similar to standard SQL. That is, you can perform any
`SELECT FROM WHERE GROUP BY HAVING ORDER BY LIMIT` query.

## [​](https://docs.lmnr.ai/sql-editor/overview#data-types) Data types

Clickhouse has numerous data types. Here are some of the most important and relevant ones.

- `DateTime64` \- represents a date and time with a precision of nanoseconds. All datetimes in Laminar are in UTC.
- `String` \- represents a string.
- `UUID` \- represents a universally unique identifier. This is used for most identifier columns.
- `Float64` \- represents a floating point number.
- `UInt64` \- represents a 64-bit unsigned integer.
- `UInt8` \- unsigned 8-bit integer. Used for enum values.

Should you need to cast anything in your query, you can use the postgres-like `'value'::type` syntax, for example:

Copy

```
SELECT name, input, output
FROM spans
WHERE start_time > '2025-01-01'::DateTime
AND start_time < '2025-01-02'::DateTime

```

### [​](https://docs.lmnr.ai/sql-editor/overview#json) JSON

Laminar stores JSONs as strings in Clickhouse.
See [Working with JSONs](https://docs.lmnr.ai/sql-editor/overview#working-with-jsons) for more details.

## [​](https://docs.lmnr.ai/sql-editor/overview#filtering-by-start-time) Filtering by start_time

Spans inside each project are ordered by `start_time`, so adding a `start_time` filter will speed up the query and prevent it from failing because of running out of memory.This is relevant to both the `spans` table and the `traces` aggregation view on it.

### [​](https://docs.lmnr.ai/sql-editor/overview#example) Example

Suppose you want to have a look at all the tool call spans in a single trace. You know the trace ID.

Copy

```
SELECT name, input, output, start_time, end_time
FROM spans
WHERE trace_id = {traceId: UUID} AND span_type = 6 -- tool call

```

You can speed up the query significantly by adding a `start_time` filter.

Copy

```
SELECT name, input, output, start_time, end_time
FROM spans
WHERE trace_id = {traceId: UUID} AND span_type = 6 -- tool call
AND start_time >= (
    SELECT start_time FROM traces WHERE trace_id = {traceId: UUID} LIMIT 1
)

```

## [​](https://docs.lmnr.ai/sql-editor/overview#avoiding-joins) Avoiding joins

Clickhouse is a columnar database, so it’s not optimized for joins. If you need to join data, you can do it in the application layer.

### [​](https://docs.lmnr.ai/sql-editor/overview#example-2) Example

Let’s say you want to have a look at LLM spans that took abnormally long time to complete and see the effect of this on their corresponding traces.In regular SQL, you would join the `spans` table with the `traces` table to get the trace duration.

Copy

```
SELECT t.duration, s.name, s.input, s.output, s.start_time, s.end_time
FROM spans s
JOIN traces t ON s.trace_id = t.trace_id
WHERE s.start_time > now() - INTERVAL '1 day'
AND s.span_type = 1 -- LLM
AND s.end_time - s.start_time > 90 -- 90 seconds

```

In Clickhouse, you would need to collect trace_ids in the application, and then query the `traces` table for each trace_id.

Copy

```
-- 1. First query
SELECT duration, name, input, output, start_time, end_time, trace_id
FROM spans
WHERE span_type = 1 -- LLM
AND start_time > now() - INTERVAL '1 day'
AND end_time - start_time > 90 -- 90 seconds

-- 2. Collect trace_ids from the first query and use them in the second query
SELECT duration
FROM traces
WHERE trace_id IN ({traceIds: Array(UUID)})

```

This may seem counter-intuitive at first, but this is the fastest and the most efficient way to do it.

## [​](https://docs.lmnr.ai/sql-editor/overview#working-with-dates) Working with dates

See the full reference in [Clickhouse documentation](https://clickhouse.com/docs/sql-reference/functions/date-time-functions).

### [​](https://docs.lmnr.ai/sql-editor/overview#truncating-datetimes) Truncating datetimes

Clickhouse has a special syntax for truncating datetimes. The most general function for truncation is `toStartOfInterval(value, interval_specifier)`.

Spans per day in the last month

Copy

```
SELECT
    toStartOfInterval(start_time, INTERVAL 1 DAY) AS day,
    count(*) AS spans_count
FROM spans
WHERE start_time > now() - INTERVAL 1 MONTH
GROUP BY day
ORDER BY day ASC

```

If you are familiar with Postgres `date_trunc` function, notice how this is similar.`toStartOfInterval` is more flexible, because you can specify any interval, not just the ones supported by `date_trunc`.For example, you can group spans within last day to 15-minute intervals.

Copy

```
SELECT
    toStartOfInterval(start_time, INTERVAL 15 MINUTE) AS interval,
    count(*) AS spans_count
FROM spans
WHERE start_time > now() - INTERVAL 1 DAY
GROUP BY interval
ORDER BY interval ASC

```

There are also convenience functions for common intervals:

- `toStartOfSecond(value)` \- truncates to the start of the second
- `toStartOfMinute(value)` \- truncates to the start of the minute
- `toStartOfTenMinutes(value)` \- truncates to the start of the minute
- `toStartOfHour(value)` \- truncates to the start of the hour
- `toStartOfDay(value)` \- truncates to the start of the day
- `toStartOfWeek(value)` \- truncates to the start of the week
- `toStartOfMonth(value)` \- truncates to the start of the month
- `toStartOfQuarter(value)` \- truncates to the start of the month
- `toStartOfYear(value)` \- truncates to the start of the year

## [​](https://docs.lmnr.ai/sql-editor/overview#working-with-json) Working with JSON

Many columns, such as `attributes` on `spans` table, contain JSON values stored as strings.
Clickhouse provides a wide variety of functions to work with JSONs. See the full reference in [Clickhouse documentation](https://clickhouse.com/docs/sql-reference/functions/json-functions).Generally, there are two families of functions to work with JSONs:

- `JSON*` functions - comprehensive set of functions that work on the JSON strings
- `simpleJSON*` functions - simpler subset that works much faster, and under a few assumptions.

We recommend using `simpleJSON*` functions, especially if you know the data type of the value you want to extract.

### [​](https://docs.lmnr.ai/sql-editor/overview#extracting-values-from-json-by-key) Extracting values from JSON by key

Most of the time, you will want to extract a value from JSON by `key`. If you know the data type of the value, you can use the `simpleJSONExtract*` functions.For example,

Copy

```
SELECT
    simpleJSONExtractInt(
        attributes,
        'gen_ai.usage.cache_read_input_tokens'
    ) AS cache_hit_tokens
FROM spans
WHERE start_time > now() - INTERVAL '1 day' AND span_type = 1 -- LLM

```

This will return the number of tokens that were read from the last day.
Note that this works only for the models and instrumentations that support caching and report this value.

### [​](https://docs.lmnr.ai/sql-editor/overview#checking-if-a-key-exists) Checking if a key exists

If you want to check if a key exists in the JSON, you can use the `simpleJSONHas` functions.
The query below will return the number of LLM spans that have a `gen_ai.request.structured_output_schema` key in the `attributes` column,
i.e. the number of LLM spans that have a structured output schema defined at request time.

Copy

```
SELECT count(*)
FROM spans
WHERE start_time > now() - INTERVAL '1 day' AND span_type = 1 -- LLM
AND simpleJSONHas(attributes, 'gen_ai.request.structured_output_schema')

```

### [​](https://docs.lmnr.ai/sql-editor/overview#nested-extraction-by-key) Nested extraction by key

If you know that a value inside a JSON object is a stringified JSON, you can use the `simpleJSONExtract*` functions repeatedly to extract the nested value.Suppose you pass a structured output schema to the LLM, and the schema always has a `description` key.

Copy

```
SELECT simpleJSONExtractString(
    simpleJSONExtractString(
        attributes,
        'gen_ai.request.structured_output_schema'
    ),
    'description'
) AS schema_description
FROM spans
WHERE start_time > now() - INTERVAL '1 day' AND span_type = 1 -- LLM
AND simpleJSONHas(attributes, 'gen_ai.request.structured_output_schema')

```

This will return the description of the structured output schema for the LLM spans that have schema defined in the last day.

### [​](https://docs.lmnr.ai/sql-editor/overview#more-complex-json-functions) More complex JSON functions

If you need more flexibility at the cost of query performance, you can use the `JSON*` functions.Here’s a quick list of things, you can do with `JSON*` functions:

- Extract the last value with Python-like index syntax from an array, e.g. `JSONExtractRaw(input, -1)` to get the last input message
- Extract a nested value from JSON by path, including array indices, e.g. `JSONExtractRaw(input, -1, 'content')` to get the last input message content
- Extract keys from a JSON object, similar to `Object.keys` or `dict.keys`, e.g. `JSONExtractKeys(attributes)`
- Extract keys and values from a JSON object, similar to `Object.entries` or `dict.items`, e.g. `JSONExtractKeysAndValues(attributes)`
- Count the number of elements in an array, e.g. `JSONLength(input)` to get the number of input messages

Full reference in ClickHouse [documentation](https://clickhouse.com/docs/sql-reference/functions/json-functions#jsonextract-functions).

[Introduction](https://docs.lmnr.ai/sql-editor/introduction) [Table schemas](https://docs.lmnr.ai/sql-editor/reference)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
