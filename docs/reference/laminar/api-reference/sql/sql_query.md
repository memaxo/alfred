---
title: SQL Query - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/api-reference/sql/sql_query#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

SQL

SQL Query

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/sql/query \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "query": "SELECT name, input_tokens FROM spans WHERE start_time > now() - interval '\''1 hour'\'' LIMIT 10"
}'
```

200

400

401

Copy

```
{
  "data": [\
    {\
      "name": "workflow",\
      "input_tokens": 0\
    },\
    {\
      "name": "openai.chat",\
      "input_tokens": 369\
    }\
  ]
}
```

POST

/

v1

/

sql

/

query

Try it

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/sql/query \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "query": "SELECT name, input_tokens FROM spans WHERE start_time > now() - interval '\''1 hour'\'' LIMIT 10"
}'
```

200

400

401

Copy

```
{
  "data": [\
    {\
      "name": "workflow",\
      "input_tokens": 0\
    },\
    {\
      "name": "openai.chat",\
      "input_tokens": 369\
    }\
  ]
}
```

## [​](https://docs.lmnr.ai/api-reference/sql/sql_query#sql-query) SQL Query

You can run SQL queries on your data stored in Laminar using the SQL query API. Learn more in the [SQL Editor](https://docs.lmnr.ai/sql-editor/introduction) reference.

### [​](https://docs.lmnr.ai/api-reference/sql/sql_query#example-request) Example request

Copy

```
{
    "query": "SELECT * FROM spans where start_time > now() - interval '1 hour' LIMIT 10"
}

```

#### Authorizations

[​](https://docs.lmnr.ai/api-reference/sql/sql_query#authorization-authorization)

Authorization

string

header

required

Bearer authentication header of the form `Bearer <token>`, where `<token>` is your auth token.

#### Body

application/json

[​](https://docs.lmnr.ai/api-reference/sql/sql_query#body-query)

query

string

required

The SQL query to execute.

Example:

`"SELECT name, input_tokens FROM spans WHERE start_time > now() - interval '1 hour' LIMIT 10"`

#### Response

200

application/json

SQL query executed successfully

[​](https://docs.lmnr.ai/api-reference/sql/sql_query#response-data)

data

any\[\]

required

The data returned from the SQL query.

Example:

```
[\
  { "name": "workflow", "input_tokens": 0 },\
  {\
    "name": "openai.chat",\
    "input_tokens": 369\
  }\
]
```

[Update Evaluation Datapoint](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
