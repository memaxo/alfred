---
title: Save Evaluation Datapoints - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Save Evaluation Datapoints

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/evals/{eval_id}/datapoints \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "groupName": "<string>",
  "points": [\
    {\
      "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "data": "<any>",\
      "index": 0,\
      "target": "<any>",\
      "metadata": {},\
      "executorOutput": "<any>",\
      "traceId": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "scores": {}\
    }\
  ]
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

Try it

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/evals/{eval_id}/datapoints \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "groupName": "<string>",
  "points": [\
    {\
      "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "data": "<any>",\
      "index": 0,\
      "target": "<any>",\
      "metadata": {},\
      "executorOutput": "<any>",\
      "traceId": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "scores": {}\
    }\
  ]
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

### [​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#description) Description

Save multiple evaluation datapoints to an existing evaluation. Each datapoint can include input, output, expected output, executor output, scores, and metadata.

The actual datapoints are not saved until you call the [Update Evaluation Datapoint](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint) endpoint.

#### Authorizations

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#authorization-authorization)

Authorization

string

header

required

Bearer authentication header of the form `Bearer <token>`, where `<token>` is your auth token.

#### Path Parameters

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#parameter-eval-id)

eval_id

string<uuid>

required

The UUID of the evaluation

#### Body

application/json

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points)

points

object\[\]

required

List of evaluation datapoint results to save.

Show child attributes

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-data)

data

any

required

Input data of the datapoint. Can be any JSON value.

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-id)

id

string<uuid>

Unique datapoint ID. If not specified, a UUID v4 will be generated.

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-index)

index

integer

default:0

Index of the datapoint. Defaults to 0.

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-target)

target

any

Target/expected output of the datapoint. Can be any JSON value.

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-metadata)

metadata

object \| null

Additional metadata for the datapoint. Defaults to empty object.

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-executor-output)

executorOutput

any

Executor output of the datapoint. Can be any JSON value.

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-trace-id)

traceId

string<uuid>

Trace ID associated with the datapoint. If not specified, a UUID v4 will be generated.

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-points-scores)

scores

object

Scores for the datapoint as key-value pairs

Show child attributes

[​](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints#body-group-name)

groupName

string

Group name for the evaluation datapoints. Defaults to 'default'.

#### Response

200

application/json

Evaluation datapoints saved successfully

The UUID of the evaluation

[Initialize Evaluation](https://docs.lmnr.ai/api-reference/evals/init_eval) [Update Evaluation Datapoint](https://docs.lmnr.ai/api-reference/evals/update_eval_datapoint)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
