---
title: Update Evaluation Datapoint - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Update Evaluation Datapoint

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/evals/{eval_id}/datapoints/{datapoint_id} \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "executorOutput": "<any>",
  "scores": {}
}'
```

200

400

401

404

Copy

```
"3c90c3cc-0d44-4b50-8888-8dd25736052a"
```

POST

/

v1

/

evals

/

{eval_id}

/

datapoints

/

{datapoint_id}

Try it

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/evals/{eval_id}/datapoints/{datapoint_id} \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "executorOutput": "<any>",
  "scores": {}
}'
```

200

400

401

404

Copy

```
"3c90c3cc-0d44-4b50-8888-8dd25736052a"
```

### [​](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#description) Description

Update a specific evaluation datapoint with new executor output and scores.

#### Authorizations

[​](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#authorization-authorization)

Authorization

string

header

required

Bearer authentication header of the form `Bearer <token>`, where `<token>` is your auth token.

#### Path Parameters

[​](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#parameter-eval-id)

eval_id

string<uuid>

required

The UUID of the evaluation

[​](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#parameter-datapoint-id)

datapoint_id

string<uuid>

required

The UUID of the datapoint

#### Body

application/json

[​](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#body-scores)

scores

object

required

Updated scores for the datapoint as key-value pairs.

Show child attributes

[​](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#body-scores-key)

scores.{key}

number \| null

[​](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint#body-executor-output)

executorOutput

any

Updated executor output of the datapoint. Can be any JSON value.

#### Response

200

application/json

Evaluation datapoint updated successfully

The UUID of the datapoint

[Save Evaluation Datapoints](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints) [SQL Query](https://docs.lmnr.ai/api-reference/sql/sql_query)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
