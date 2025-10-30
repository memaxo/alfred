---
title: Sending custom events to Laminar - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/events#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

Sending custom events to Laminar

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Introduction](https://docs.lmnr.ai/tracing/events#introduction)
- [Sending events](https://docs.lmnr.ai/tracing/events#sending-events)
- [Span context](https://docs.lmnr.ai/tracing/events#span-context)
- [Timestamp](https://docs.lmnr.ai/tracing/events#timestamp)
- [Attributes](https://docs.lmnr.ai/tracing/events#attributes)
- [Specifying session or user id](https://docs.lmnr.ai/tracing/events#specifying-session-or-user-id)
- [Querying events](https://docs.lmnr.ai/tracing/events#querying-events)

Laminar allows you to send custom events to the platform. This can be useful for tracking any events that are not covered by the spans and tracing.

## [​](https://docs.lmnr.ai/tracing/events\#introduction)  Introduction

You can think of events as a data payload attached to a single timestamp.Main difference between events and spans is that events have a single timestamp and don’t have a duration.Events allow you to track **any free-form data** that happens in your applicationYou can then run [queries](https://docs.lmnr.ai/sql-editor/introduction) on the events to get event-based analytics and insights. You can also build [custom dashboards](https://docs.lmnr.ai/custom-dashboards/overview) to visualize the events.

## [​](https://docs.lmnr.ai/tracing/events\#sending-events)  Sending events

To send an event, simply use the `event` function on `Laminar` class.

- TypeScript

- Python


Copy

```
import { Laminar } from "@lmnr-ai/lmnr"

Laminar.initialize();

Laminar.event({
    name: "my-event",
    attributes: {
        "user-feedback": "positive",
        "user_data": JSON.stringify({
            "name": "John Doe",
            "age": 30,
            "email": "john.doe@example.com"
        })
    }
})

```

### [​](https://docs.lmnr.ai/tracing/events\#span-context)  Span context

If you create an event inside a span context, e.g. in an `observe` d function, the event will be associated with the current span.Otherwise, we will create a new span for the event and attach the event to it.

### [​](https://docs.lmnr.ai/tracing/events\#timestamp)  Timestamp

By default, event will have the current timestamp.You can also specify the timestamp manually:

- TypeScript

- Python


Copy

```
import { Laminar } from "@lmnr-ai/lmnr"

Laminar.initialize();

Laminar.event({
    name: "my-event",
    timestamp: new Date("2025-01-01T00:00:00.000Z")
})

```

### [​](https://docs.lmnr.ai/tracing/events\#attributes)  Attributes

Attributes are passed as an object/dictionary. Allowed attribute types are `string`, `number`, `boolean`, `string[]`, `number[]`, `boolean[]`.

If you want to pass a JSON object as an attribute, you need to stringify it first.

## [​](https://docs.lmnr.ai/tracing/events\#specifying-session-or-user-id)  Specifying session or user id

You can associate an event with a session id or user id.

- TypeScript

- Python


Copy

```
import { Laminar } from "@lmnr-ai/lmnr"

Laminar.initialize();

Laminar.event({
    name: "my-event",
    sessionId: "123",
    userId: "456"
})

```

## [​](https://docs.lmnr.ai/tracing/events\#querying-events)  Querying events

You can query events using the `events` table in Laminar [SQL Editor](https://docs.lmnr.ai/sql-editor/introduction).

Copy

```
SELECT * FROM events
WHERE session_id = '123'
AND timestamp >= '2025-01-01T00:00:00'

```

[LangGraph Visualization](https://docs.lmnr.ai/tracing/langgraph-visualization) [OpenTelemetry integration](https://docs.lmnr.ai/tracing/otel)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.