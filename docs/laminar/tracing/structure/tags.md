---
title: Tagging traced spans - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/structure/tags#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Tagging traced spans

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/structure/tags#overview)
- [1\. Adding tags to a span when it is created](https://docs.lmnr.ai/tracing/structure/tags#1-adding-tags-to-a-span-when-it-is-created)
- [Example. Tagging a manual span](https://docs.lmnr.ai/tracing/structure/tags#example-tagging-a-manual-span)
- [Example. Tagging an observed function](https://docs.lmnr.ai/tracing/structure/tags#example-tagging-an-observed-function)
- [Example. Tagging any span from within its context](https://docs.lmnr.ai/tracing/structure/tags#example-tagging-any-span-from-within-its-context)
- [2\. Adding tags to a span once it is created](https://docs.lmnr.ai/tracing/structure/tags#2-adding-tags-to-a-span-once-it-is-created)
- [2.1. Tagging in the Laminar UI](https://docs.lmnr.ai/tracing/structure/tags#2-1-tagging-in-the-laminar-ui)
- [2.2. Tagging in the Laminar SDK](https://docs.lmnr.ai/tracing/structure/tags#2-2-tagging-in-the-laminar-sdk)
- [Viewing tags](https://docs.lmnr.ai/tracing/structure/tags#viewing-tags)
- [Filtering by span tags](https://docs.lmnr.ai/tracing/structure/tags#filtering-by-span-tags)

## [​](https://docs.lmnr.ai/tracing/structure/tags\#overview)  Overview

Tags are string identifiers that you can attach to spans. They are used to categorize and filter spans.You can either add tags to a span when it is created, or post-hoc after a span has been created.

## [​](https://docs.lmnr.ai/tracing/structure/tags\#1-adding-tags-to-a-span-when-it-is-created)  1\. Adding tags to a span when it is created

Sometimes you have some context prior to running a function and you want to tag it at
creation time. For example, you may want to tag a span with the model provider
endpoint that you use, or the test dataset that you used to run the request.Note that tags are not the same as metadata. Metadata is additional information about a trace
in a form of key-value pairs. Tags are used to categorize and filter spans, and they must
be created in the Laminar UI in advance. See [metadata](https://docs.lmnr.ai/tracing/structure/metadata) for a more detailed
comparison.

### [​](https://docs.lmnr.ai/tracing/structure/tags\#example-tagging-a-manual-span)  Example. Tagging a manual span

This is a dynamic way to tag a span, i.e. you can create tags at runtime.

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar } from '@lmnr-ai/lmnr';

const span = Laminar.startSpan('foo', { tags: ["my_tag", "another_tag"] });
// elsewhere
Laminar.withSpan(span, () => {
    // your code here
})

```

Note that only the span created by this `Laminar.startSpan` call will have the tags.

### [​](https://docs.lmnr.ai/tracing/structure/tags\#example-tagging-an-observed-function)  Example. Tagging an `observe` d function

This is a static way to tag a span, i.e. the `observe` d function will always have the same set of tags.

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar, observe } from '@lmnr-ai/lmnr';

await observe(
  {
    name: "foo",
    tags: ["my_tag", "another_tag"]
  },
  async (message) => {
    // your code here
  },
  "Hello, world!"
)

```

### [​](https://docs.lmnr.ai/tracing/structure/tags\#example-tagging-any-span-from-within-its-context)  Example. Tagging any span from within its context

Note that for adding span tags to work, you must call it inside
a span context. This is why we use `observe` here.

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar, observe } from '@lmnr-ai/lmnr';

async function foo(message: string) {
  if (message.length > 100) {
    // ✅ Correct usage. We are inside an `observe`d function,
    Laminar.addSpanTags(["long_input"]);
  }
}

// ❌ Incorrect usage. We are not inside any span context. This will not work.
// Laminar.addSpanTags(["my_tag", "another_tag"])

await observe(
  {
    name: "foo",
  },
  foo,
  "a".repeat(200)
)

```

## [​](https://docs.lmnr.ai/tracing/structure/tags\#2-adding-tags-to-a-span-once-it-is-created)  2\. Adding tags to a span once it is created

This is useful to incorporate user feedback into the trace for further analysis.

### [​](https://docs.lmnr.ai/tracing/structure/tags\#2-1-tagging-in-the-laminar-ui)  2.1. Tagging in the Laminar UI

Once you’ve created and sent a trace to Laminar, you can add tags to the spans in the Laminar UI.![Tags in the Laminar UI](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tag-from-ui.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=4b3f951e4005b6bc3177f8efd1070520)

### [​](https://docs.lmnr.ai/tracing/structure/tags\#2-2-tagging-in-the-laminar-sdk)  2.2. Tagging in the Laminar SDK

You can also add tags to a span in the Laminar SDK. You will need to save
the trace ID and then add tags to the root span of that trace using
`LaminarClient.tags.tag`.

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar, LaminarClient, observe } from '@lmnr-ai/lmnr';

const laminarClient = new LaminarClient();

// Take note of the traceId.
const { traceId, responseText } = await observe(
  {
    name: "chat_completion",
  },
  async (message: string) => {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: message }],
    });
    const responseText = response.choices[0].message.content;
    return {
      // ✅ Correct usage. We are inside an `observe`d function,
      // so `getTraceId` returns a string UUID.
      traceId: Laminar.getTraceId(),
      responseText,
    }
  },
  "Hello, world!"
)

// Call this function later, when you get user feedback.
const userFeedbackHandler = (
  traceId: string,
  userFeedback: "good" | "bad"
) => laminarClient.tags.tag(traceId, userFeedback);

```

Make sure to call `Laminar.getTraceId` inside a span context, e.g.
inside an `observe` d function. Otherwise, it will return `null`.

## [​](https://docs.lmnr.ai/tracing/structure/tags\#viewing-tags)  Viewing tags

The tags will be visible in the Laminar UI, shown on each span as shields.![Tags in the Laminar UI](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tags-example.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=9d9a4fa033ca08fbce63842fe810fc50)

### [​](https://docs.lmnr.ai/tracing/structure/tags\#filtering-by-span-tags)  Filtering by span tags

In the traces view and the spans view, you can filter by span tags.Simply add a “Tags” filter and type the name of the tag you want to include.![Adding a tag filter](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tags-add-filter.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=80553c01f655694da8626ff3dda587be)![Filtered traces](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tags-filtered.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=84a683030bc89795187db49b0beca081)

[Metadata](https://docs.lmnr.ai/tracing/structure/metadata) [Image Tracing](https://docs.lmnr.ai/tracing/structure/image)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Tags in the Laminar UI](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tag-from-ui.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=80f47418e9fc2fc14ce293101e42e42e)

![Tags in the Laminar UI](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tags-example.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=d32275db7c3218d0a5b484251151293d)

![Adding a tag filter](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tags-add-filter.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=6b717c96bcdcb4ca114829f068648f8e)

![Filtered traces](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/tags-filtered.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=3d52329c1e5f8eb0c6e63674e66ac6e8)