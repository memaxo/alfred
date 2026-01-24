---
title: Introduction to Laminar SQL Editor - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/sql-editor/introduction#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

SQL Editor

Introduction to Laminar SQL Editor

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Features](https://docs.lmnr.ai/sql-editor/introduction#features)
- [Allowed queries](https://docs.lmnr.ai/sql-editor/introduction#allowed-queries)
- [Getting started](https://docs.lmnr.ai/sql-editor/introduction#getting-started)
- [Prerequisites](https://docs.lmnr.ai/sql-editor/introduction#prerequisites)
- [Using the SQL Editor](https://docs.lmnr.ai/sql-editor/introduction#using-the-sql-editor)
- [Using SQL Query API](https://docs.lmnr.ai/sql-editor/introduction#using-sql-query-api)
- [Example query](https://docs.lmnr.ai/sql-editor/introduction#example-query)
- [Viewing results](https://docs.lmnr.ai/sql-editor/introduction#viewing-results)
- [Exporting results](https://docs.lmnr.ai/sql-editor/introduction#exporting-results)
- [Next steps](https://docs.lmnr.ai/sql-editor/introduction#next-steps)

Laminar SQL Editor allows you to query all your data stored at Laminar using SQL.

The SQL Editor is currently in beta.
Some functionality may change.
We value your feedback and suggestions.
Please [contact us](mailto:founders@laminar.ai) or join our [Discord](https://discord.gg/nNFUUDAKub) to share your thoughts.

Laminar SQL editor queries data stored in [ClickHouse](https://clickhouse.com/).
Queries must be written in [ClickHouse SQL](https://clickhouse.com/docs/sql-reference).For detailed reference of the syntax, see the [reference](https://docs.lmnr.ai/sql-editor/reference) page.

## [​](https://docs.lmnr.ai/sql-editor/introduction#features) Features

- Query all your data stored at Laminar using SQL
- Write custom complex queries to connect different data within your project
- Fast analytics on your data, e.g.
  - Detailed breakdown of token count and cost by operation
  - Detailed latency analysis by operation
  - Dig into deeply nested trace data
- Create custom dashboards
- Export query results to Laminar datasets or labelling queues
- Query data via API to connect to your own tools and workflows

## [​](https://docs.lmnr.ai/sql-editor/introduction#allowed-queries) Allowed queries

- Only `SELECT` queries are allowed.
- Allowed tables (to select from):
  - `spans`
  - `traces`
  - `events`
  - `evaluation_scores`
  - `evaluation_datapoints`

For detailed information about the tables and columns, see the [reference](https://docs.lmnr.ai/sql-editor/reference) page.

## [​](https://docs.lmnr.ai/sql-editor/introduction#getting-started) Getting started

### [​](https://docs.lmnr.ai/sql-editor/introduction#prerequisites) Prerequisites

- You must have some data stored at Laminar, such as traces or evaluation results.

### [​](https://docs.lmnr.ai/sql-editor/introduction#using-the-sql-editor) Using the SQL Editor

SQL Editor is available in the sidebar.![SQL Editor in sidebar on Laminar](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/sql-editor/sidebar.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=b21822cf53b9b9171252c58a6be12ff0)

### [​](https://docs.lmnr.ai/sql-editor/introduction#using-sql-query-api) Using SQL Query API

You can also run queries directly from the API. It is available at the `/v1/sql/query` endpoint.Querying via API is identical to using the SQL Editor, you simply pass the `query` as a parameter.Read the [API reference](https://docs.lmnr.ai/api-reference/sql/sql_query) page for more information.

### [​](https://docs.lmnr.ai/sql-editor/introduction#example-query) Example query

Copy

```
SELECT
    input,
    output,
    start_time
FROM spans
WHERE start_time BETWEEN now() - INTERVAL '3 days' AND now()

```

This query will return the input and output of the spans in the last 3 days.

### [​](https://docs.lmnr.ai/sql-editor/introduction#viewing-results) Viewing results

Results are displayed in a table or raw JSON view.![JSON View of the results](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/sql-editor/json-view.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=80eccfc1217b63c21d5c9982d572e816)

### [​](https://docs.lmnr.ai/sql-editor/introduction#exporting-results) Exporting results

Once you have selected the results you want to export, click the “Export to Dataset” button.Choose the dataset you want to export to and map the columns to the dataset `data`, `metadata`, and `target` fields.![Export to Dataset](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/sql-editor/export-to-dataset.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=c5f6c66b1fe7b12ffe51c53b88ccb089)[Learn more about datasets](https://docs.lmnr.ai/datasets/introduction)

## [​](https://docs.lmnr.ai/sql-editor/introduction#next-steps) Next steps

- [Overview](https://docs.lmnr.ai/sql-editor/overview) – Overview of the Laminar SQL Editor and how to use it
- [Reference](https://docs.lmnr.ai/sql-editor/reference) – Reference of the table schemas and best practices

[Scoring with SDK](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-sdk) [Overview](https://docs.lmnr.ai/sql-editor/overview)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![SQL Editor in sidebar on Laminar](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/sql-editor/sidebar.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=da2ff7a2b348e01350f150ac2083e5d0)

![JSON View of the results](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/sql-editor/json-view.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=8b5325f3f22114333d6545de77c7a32d)

![Export to Dataset](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/sql-editor/export-to-dataset.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=25fedf2f0a4a8891a1bab96305f2f524)
