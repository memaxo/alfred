---
title: Initialize Evaluation - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/api-reference/evals/init_eval#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Initialize Evaluation

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/evals \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "<string>",
  "groupName": "<string>"
}'
```

200

400

401

Copy

```
{
  "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
  "name": "<string>",
  "projectId": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
  "groupName": "<string>",
  "createdAt": "2023-11-07T05:31:56Z"
}
```

POST

/

v1

/

evals

Try it

cURL

cURL

Copy

```
curl --request POST \
  --url https://api.lmnr.ai/v1/evals \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "<string>",
  "groupName": "<string>"
}'
```

200

400

401

Copy

```
{
  "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
  "name": "<string>",
  "projectId": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
  "groupName": "<string>",
  "createdAt": "2023-11-07T05:31:56Z"
}
```

### [​](https://docs.lmnr.ai/api-reference/evals/init_eval#description) Description

Create a new evaluation with an optional name and group. If no name is provided, a random name will be generated automatically.

#### Authorizations

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#authorization-authorization)

Authorization

string

header

required

Bearer authentication header of the form `Bearer <token>`, where `<token>` is your auth token.

#### Body

application/json

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#body-name)

name

string

Name of the evaluation. If not specified, a random name will be generated.

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#body-group-name)

groupName

string \| null

Group name for the evaluation. Defaults to 'default'.

#### Response

200

application/json

Evaluation created successfully

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#response-id)

id

string<uuid>

required

The unique identifier of the evaluation

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#response-name)

name

string

required

The name of the evaluation

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#response-project-id)

projectId

string<uuid>

required

The project ID this evaluation belongs to

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#response-group-name)

groupName

string

required

The group name of the evaluation

[​](https://docs.lmnr.ai/api-reference/evals/init_eval#response-created-at)

createdAt

string<date-time>

When the evaluation was created

[Overview](https://docs.lmnr.ai/api-reference/introduction) [Save Evaluation Datapoints](https://docs.lmnr.ai/api-reference/evals/save_eval_datapoints)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
