---
title: Disable content tracing - Laminar documentation
url:
description: Disable content tracing for a span
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/structure/tracing-level#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Disable content tracing

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

Sometimes, you may want to dynamically disable tracing for a particular span.
For example, some of your customers need more privacy than others, and you only
want to collect metadata for some of them.To achieve this, we offer a wrapper that can set tracing to one of the following modes:

- `ALL` – trace everything as normal
- `META_ONLY` – do not trace inputs and outputs
- `OFF` – do not trace anything within the wrapper

- JavaScript/TypeScript

- Python

Copy

```
// only available since v0.4.25
import { withTracingLevel, TracingLevel } from "@lmnr-ai/lmnr";

withTracingLevel(TracingLevel.OFF, () => {
    // your code here
});

// code here is traced normally

```

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
