---
title: OpenTelemetry integration - Laminar documentation
url:
description: Details on Spans and attributes in OpenTelemetry-compatible tracing with Laminar
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/otel#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

OpenTelemetry integration

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Introduction](https://docs.lmnr.ai/tracing/otel#introduction)
- [Exporters](https://docs.lmnr.ai/tracing/otel#exporters)
- [Getting started](https://docs.lmnr.ai/tracing/otel#getting-started)
- [Example](https://docs.lmnr.ai/tracing/otel#example)
- [Endpoint](https://docs.lmnr.ai/tracing/otel#endpoint)
- [Authorization](https://docs.lmnr.ai/tracing/otel#authorization)
- [Troubleshooting](https://docs.lmnr.ai/tracing/otel#troubleshooting)
- [Span reference](https://docs.lmnr.ai/tracing/otel#span-reference)
- [Span object](https://docs.lmnr.ai/tracing/otel#span-object)
- [Span attributes](https://docs.lmnr.ai/tracing/otel#span-attributes)

Laminar uses OpenTelemetry for tracing. That is, Laminar’s backend is compatible with OpenTelemetry.
This page details the methods to send your OpenTelemetry traces to Laminar, even if you are not using Laminar’s SDK.If you are using Laminar’s SDK, refer to the [tracing](https://docs.lmnr.ai/tracing/introduction) page to get started.
Still feel free to read this page to get basic understanding of the internals of OpenTelemetry and how it works with Laminar.

## [​](https://docs.lmnr.ai/tracing/otel#introduction) Introduction

OpenTelemetry is a framework for tracing and monitoring distributed systems. OpenLLMetry is
an extension of OpenTelemetry that is specifically designed for LLM tracing. The standards
introduced in OpenLLMetry are gradually being adopted by OpenTelemetry.OpenTelemetry covers tracing, metrics, and logs, but Laminar only uses tracing. For more details
about tracing in Laminar, and a quick intro to the core concepts, see the [Tracing](https://docs.lmnr.ai/tracing/introduction) page.Processing of OpenTelemetry traces has many concepts and components, namely, exporters,
processors, propagators, samplers, and collectors.For the purposes of this page, we will focus on the exporters.

### [​](https://docs.lmnr.ai/tracing/otel#exporters) Exporters

Exporter is the client-side component that sends spans (and thus traces) to an OpenTelemetry-compatible backend.It is responsible for the payload format and the transport protocol.
The default protocol is [OTLP](https://opentelemetry.io/docs/specs/otel/protocol/),
which underneath uses protobuf in one of the following formats:

- Protobuf in gRPC (commonly known as OTLP/gRPC)
- Protobuf over HTTP with binary encoding (commonly known as OTLP/HTTP/proto)
- Protobuf over HTTP with JSON encoding (commonly known as OTLP/HTTP/json, is used rarely).

Laminar’s backend (both cloud and self-hosted) supports OTLP/gRPC and OTLP/HTTP/proto formats.
OTLP/gRPC is recommended for performance and reliability reasons.

Laminar’s backend does not support OTLP/HTTP/json.

Here’s a quick comparison of formats that Laminar supports:

|                                      | OTLP/gRPC             | OTLP/HTTP/proto       |
| ------------------------------------ | --------------------- | --------------------- |
| Supported                            | ✅                    | ✅                    |
| Recommended                          | ✅                    | ❌                    |
| Underlying protocol                  | gRPC over HTTP/2      | HTTP/1.1              |
| Encoding format                      | protobuf              | protobuf              |
| Base URL for Laminar cloud           | `https://api.lmnr.ai` | `https://api.lmnr.ai` |
| Port at Laminar cloud                | `8443`                | `443`                 |
| Default port for self-hosted backend | `8001`                | `8000`                |
| Path                                 | `/v1/traces` \[1\]    | `/v1/traces` \[1\]    |

\[1\] In OpenTelemetry Node and Python SDKs,
this path is appended (unless specified explicitly) in gRPC exporter, but not in the HTTP exporter.

## [​](https://docs.lmnr.ai/tracing/otel#getting-started) Getting started

Usually, OpenTelemetry tracing in other libraries is initialized once at the start of the application
by calling a function like `initTracer()`. Functions like this usually accept a configuration object
or a set of parameters, including the exporter configuration.To send traces to Laminar, you need to configure the endpoint and the authorization.

### [​](https://docs.lmnr.ai/tracing/otel#example) Example

- JavaScript/TypeScript

- Python

Copy

```
import { Metadata } from '@grpc/grpc-js';
// it is important to import the OTLP exporter from the
// `@opentelemetry/exporter-trace-otlp-grpc` package
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const metadata = new Metadata();
metadata.set('authorization', `Bearer ${process.env.LMNR_PROJECT_API_KEY}`);
const exporter = new OTLPTraceExporter({
  url: "https://api.lmnr.ai:8443/v1/traces",
  metadata,
});

functionThatInitiatesTracer({
    exporter
});

```

### [​](https://docs.lmnr.ai/tracing/otel#endpoint) Endpoint

The default base url for the endpoint is `https://api.lmnr.ai` listening
for gRPC traffic on port `8443`.For the self-hosted backend, the base url is `http://<your-self-hosted-backend-url>`
and the default port is `8001`, unless you have changed the configuration.The `/v1/traces` path is the default OpenTelemetry trace endpoint, and Laminar listens
at this path. In both JavaScript (OpenTelemetry Node SDK) and Python OpenTelemetry SDKs,
the gRPC implementation appends `/v1/traces` to the base url, if you don’t specify it.
Be careful though if you are using the HTTP exporter, as the HTTP implementation does not append it.

### [​](https://docs.lmnr.ai/tracing/otel#authorization) Authorization

The authorization header is required to send traces to Laminar. We use bearer authentication,
so the header should start with `Bearer ` and the token is your
[project API key](http://localhost:3001/tracing/introduction#getting-started).The right way to set the headers for gRPC requests is to use the metadata object. Even though
gRPC is sent over HTTP/2, and metadata is sent as HTTP headers, it is different from
raw HTTP headers. Learn more about metadata in the [gRPC documentation](https://grpc.io/docs/guides/metadata/).

If you specify the raw HTTP headers for a gRPC request, Laminar will not be able to process them.
This is especially relevant for the exporter in Node.js, which accepts both
`metadata` and `headers` parameters. The latter is effectively ignored by Laminar backend.

gRPC metadata has a restricted set of keys, and so many client implementations,
including the OpenTelemetry Python SDK, check the keys for validity,
effectively imposing case-sensitivity. That is, `authorization` has to start with
lowercase `a`.

At the time of writing, Python SDK throws an error if the key is
`Authorization` with capital `A`. If you are specifying the key as `Authorization`
and not seeing an error saying `TypeError: not all arguments converted during string formatting`,
you are probably using the HTTP exporter, which is not recommended.

### [​](https://docs.lmnr.ai/tracing/otel#troubleshooting) Troubleshooting

If you are facing issues, please refer to the [Troubleshooting OpenTelemetry](https://docs.lmnr.ai/tracing/troubleshooting-opentelemetry) page.

## [​](https://docs.lmnr.ai/tracing/otel#span-reference) Span reference

This section is solely for information purposes.
As a user of Laminar, you don’t have to deal with the internals of OpenTelemetry.

### [​](https://docs.lmnr.ai/tracing/otel#span-object) Span object

| Attribute            | Description                                                                                                                                                                                  | Type                                                                                            | Laminar representation (if different) | Example                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------- |
| trace_id             | Unique identifier for the trace                                                                                                                                                              | 16-bytes                                                                                        | UUID \[1\]                            | `01234567-89ab-4def-0123-456789abcdef` |
| span_id              | Unique identifier for the span                                                                                                                                                               | 8-bytes                                                                                         | UUID \[1\]                            | `00000000-0000-0000-0123-456789abcdef` |
| parent_span_id       | Unique identifier for the parent span                                                                                                                                                        | 8-bytes                                                                                         | UUID \[1\]                            | `00000000-0000-0000-0123-456789abcdef` |
| name                 | Name of the span                                                                                                                                                                             | string                                                                                          |                                       | `my_function`                          |
| events               | Events associated with the span                                                                                                                                                              | Array<Event>                                                                                    |                                       |                                        |
| attributes           | Attributes associated with the span. Fully compatible with the `gen_ai` [semantic conventions](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) | Key-value pair. Key must comply to semantic conventions, value must be of `AttributeType` \[2\] |                                       | `{"gen_ai.usage.output_tokens": 369}`  |
| start_time_unix_nano | Start time of the span in nanoseconds \[3\]                                                                                                                                                  | number                                                                                          | timestamp with UTC timezone           | `1630000000000000000`                  |
| end_time_unix_nano   | End time of the span in nanoseconds \[3\]                                                                                                                                                    | number                                                                                          | timestamp with UTC timezone           | `1630000000000000000`                  |

\[1\] 13th digit in hex UUID depends on UUID version, so technically converting [OTel/WC3’s](https://www.w3.org/TR/trace-context/#trace-id) 16-byte and, especially, 8-byte IDs
to UUIDs is not exactly UUID.\[2\] `AttributeType` is a union of `string`, `number`, `boolean`, `Array<string>`, `Array<number>`, `Array<boolean>`\[3\] In most OpenTelemetry client implementations, you don’t have to convert the timestamp to nanoseconds manually,
you can simply pass the `Date` / `datetime` object and the client will convert it to nanoseconds.

### [​](https://docs.lmnr.ai/tracing/otel#span-attributes) Span attributes

Span attribute values that Laminar bases some of its functionality on:

| Attribute                     | Description                                                                                                                                        | Type                         | Example                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| `lmnr.span.type`              | Type of the span                                                                                                                                   | string ( `LLM` or `DEFAULT`) | `LLM`                             |
| `lmnr.span.path`              | Path of the span                                                                                                                                   | string                       | `agent.generate.openai.chat`      |
| `gen_ai.system`               | Model provider                                                                                                                                     | string                       | `openai`                          |
| `gen_ai.usage.output_tokens`  | Number of tokens the LLM produced                                                                                                                  | number                       | 369                               |
| `gen_ai.usage.input_tokens`   | Number of tokens in the LLM input                                                                                                                  | number                       | 42                                |
| `llm.usage.total_tokens`      | Total number of tokens in the LLM input and output. If not specified, sum of `input_tokens` and `output_tokens`                                    | number                       | 411                               |
| `gen_ai.usage.cost`           | Cost of the LLM call. If not specified, `system`, `input_tokens`, and `output_tokens` are used to estimate the cost Laminar-side in the background | number                       | 0.012                             |
| `gen_ai.usage.input_cost`     | Cost of the inputs to the LLM call. If not specified, `system` and `input_tokens` are used to estimate the cost Laminar-side in the background     | number                       | 0.003                             |
| `gen_ai.usage.output_cost`    | Cost of the outputs of the LLM call. If not specified, `system`, and `output_tokens` are used to estimate the cost Laminar-side in the background  | number                       | 0.009                             |
| `gen_ai.usage.request_model`  | Model name specified in the request                                                                                                                | string                       | `gpt-4o`                          |
| `gen_ai.usage.response_model` | Model name returned in the response                                                                                                                | string                       | `gpt-4o-2024-08-06`               |
| `gen_ai.prompt.{i}.content`   | Content of the input message number i (starting from 0)                                                                                            | string                       | `write a poem about laminar flow` |
| `gen_ai.prompt.{i}.role`      | Role of the input message number i (starting from 0)                                                                                               | string                       | `user`                            |

These _and_ all other attributes are stored as key-value pairs in the `attributes` field of the span.

[Custom events](https://docs.lmnr.ai/tracing/events) [Troubleshooting](https://docs.lmnr.ai/tracing/troubleshooting)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
