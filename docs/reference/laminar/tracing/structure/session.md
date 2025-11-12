---
title: Grouping traces together using sessions - Laminar documentation
url: 
description: Group related traces together using sessions
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/structure/session#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Grouping traces together using sessions

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [What Are Sessions?](https://docs.lmnr.ai/tracing/structure/session#what-are-sessions%3F)
- [Creating Sessions](https://docs.lmnr.ai/tracing/structure/session#creating-sessions)
- [Alternative: Setting Session ID with Observe](https://docs.lmnr.ai/tracing/structure/session#alternative%3A-setting-session-id-with-observe)
- [Viewing Sessions](https://docs.lmnr.ai/tracing/structure/session#viewing-sessions)
- [Use Cases](https://docs.lmnr.ai/tracing/structure/session#use-cases)
- [Chatbot Conversations](https://docs.lmnr.ai/tracing/structure/session#chatbot-conversations)
- [Multi-step Workflows](https://docs.lmnr.ai/tracing/structure/session#multi-step-workflows)

## [​](https://docs.lmnr.ai/tracing/structure/session\#what-are-sessions%3F)  What Are Sessions?

Sessions in Laminar provide a way to group related traces together. This is particularly useful for:

- Grouping traces from a single user interaction
- Connecting multiple API requests that form a logical sequence
- Organizing conversational turns in a chatbot
- Tracking complex workflows across multiple functions or services

For example, in a conversational agent, each turn in the conversation might be represented as a trace, while the entire conversation would be a session.

## [​](https://docs.lmnr.ai/tracing/structure/session\#creating-sessions)  Creating Sessions

You can associate a trace with a session using the following methods:

- JavaScript/TypeScript

- Python


Use the `Laminar.setTraceSessionId` function inside a span context:

Copy

```
import { Laminar, observe } from "@lmnr-ai/lmnr";

Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
  instrumentModules: {
    // your libraries to instrument
  },
});

await observe({ name: "myFunction" }, async () => {
  Laminar.setTraceSessionId("session123");
  // Your code here
});

```

## [​](https://docs.lmnr.ai/tracing/structure/session\#alternative%3A-setting-session-id-with-observe)  Alternative: Setting Session ID with Observe

You can also set the session ID directly when using the `observe` decorator/wrapper:

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar, observe } from "@lmnr-ai/lmnr";

// Set session ID in the observe function
await observe(
  {
    name: "myFunction",
    sessionId: "session123"
  },
  async () => {
    // Function code here
  }
);

```

## [​](https://docs.lmnr.ai/tracing/structure/session\#viewing-sessions)  Viewing Sessions

To view sessions in the Laminar UI:

1. Navigate to the Traces page
2. Select the “Sessions” tab
3. Click on a session to expand it and see all traces within that session

![Sessions view](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/sessions.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=ed11578dd3b116f3e7a6c59257e7811e)

Each trace within a session contains the same information as a standalone trace:

![A trace in a session](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-in-session.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=74a2f70cd5af4e0733f50d0a32deae89)

## [​](https://docs.lmnr.ai/tracing/structure/session\#use-cases)  Use Cases

### [​](https://docs.lmnr.ai/tracing/structure/session\#chatbot-conversations)  Chatbot Conversations

For a chatbot, each user message and response can be a separate trace, with the entire conversation as a session:

Copy

```
@observe()
def handle_turn(user_message, conversation_id):
    # Must be within span context
    Laminar.set_trace_session_id(session_id=conversation_id)
    # Process message, call LLMs, etc.
    return response

```

### [​](https://docs.lmnr.ai/tracing/structure/session\#multi-step-workflows)  Multi-step Workflows

For complex workflows spanning multiple API calls:

Copy

```
// Start a session for a user's checkout process
await observe(
  {
    name: "checkout",
    sessionId: `checkout-${userId}`
  },
  async () => {
    // Each step in the process is a separate trace
    await observe({ name: "validateCart" }, async () => { /* ... */ });
    await observe({ name: "processPayment" }, async () => { /* ... */ });
    await observe({ name: "createOrder" }, async () => { /* ... */ });
  },
);

```

[Manual Span Creation](https://docs.lmnr.ai/tracing/structure/manual-span-creation) [User ID](https://docs.lmnr.ai/tracing/structure/user-id)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Sessions view](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/sessions.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=6798120dd8420786eac67cea9784dd42)

![A trace in a session](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-in-session.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=97ef687d91d918d1acf1e585e3c6cbd3)