---
title: Overview - Laminar documentation
url:
description: General guidelines on using our API
language: en
---

[Skip to main content](https://docs.lmnr.ai/api-reference/introduction#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

API Documentation

Overview

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [General](https://docs.lmnr.ai/api-reference/introduction#general)
- [Authentication](https://docs.lmnr.ai/api-reference/introduction#authentication)

## [​](https://docs.lmnr.ai/api-reference/introduction#general) General

Use the following base URL: `https://api.lmnr.ai/v1`For example, `POST https://api.lmnr.ai/v1/sql/query`For more detailed information about each endpoint or schema, check our OpenAPI specification. [**Laminar OpenAPI specification** \\
\\
Full OpenAPI specification file](https://github.com/lmnr-ai/docs/blob/main/api-reference/openapi.json) Each endpoint’s page in OpenAPI specification specifies the method, path and parameters to be used. Additionally, you can try sending the request from there.

## [​](https://docs.lmnr.ai/api-reference/introduction#authentication) Authentication

All API endpoints are authenticated using Project API key as Bearer token.To get the token, go to “settings” page and move to “Project API keys” section. Then get a token from there or generate a new one.Note that each project has different Project API keys. For switching between projects, press “Laminar” icon at the top-left of the dashboard.

![Project API key bearer tokens](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/api-reference/project-api-key.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=cd8edf6d7f527ab0669b1a27d3835aab)

Press settings on the navbar and go to Project API Keys section

[Initialize Evaluation](https://docs.lmnr.ai/api-reference/evals/init_eval)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Project API key bearer tokens](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/api-reference/project-api-key.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=68ac97f91d3750a990405a20ede332bf)
