---
title: Storage in Mastra | Mastra Docs
url: 
description: Overview of Mastra's storage system and data persistence capabilities.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/server-db/storage#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Server & DB](https://mastra.ai/en/docs/server-db/local-dev-playground "Server & DB") Storage

Copy page

# MastraStorage

`MastraStorage` provides a unified interface for managing:

- **Suspended Workflows**: the serialized state of suspended workflows (so they can be resumed later)
- **Memory**: threads and messages per `resourceId` in your application
- **Traces**: OpenTelemetry traces from all components of Mastra
- **Eval Datasets**: scores and scoring reasons from eval runs

![Diagram showing storage in Mastra](https://mastra.ai/_next/image?url=%2Fimage%2Fmastra-storage-overview-light.png&w=1920&q=75)

Mastra provides different storage providers, but you can treat them as interchangeable. Eg, you could use libsql in development but postgres in production, and your code will work the same both ways.

## Configuration [Permalink for this section](https://mastra.ai/en/docs/server-db/storage\#configuration)

Mastra can be configured with a default storage option:

```nextra-code

import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";

const mastra = new Mastra({
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
});
```

If you do not specify any `storage` configuration, Mastra will not persist data across application restarts or deployments. For any
deployment beyond local testing you should provide your own storage
configuration either on `Mastra` or directly within `new Memory()`.

## Data Schema [Permalink for this section](https://mastra.ai/en/docs/server-db/storage\#data-schema)

MessagesThreadsResourcesWorkflowsEval DatasetsTraces

### Messages

Stores conversation messages and their metadata. Each message belongs to a thread and contains the actual content along with metadata about the sender role and message type.

id

uuidv4

PRIMARYKEY

NOT NULL

Unique identifier for the message (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

thread\_id

uuidv4

FK → threads.id

NOT NULL

Parent thread reference

resourceId

uuidv4

CAN BE NULL

ID of the resource that owns this message

content

text

NOT NULL

JSON of the message content in V2 format. Example: `{ format: 2, parts: [...] }`

role

text

NOT NULL

Enum of `user | assistant`

createdAt

timestamp

NOT NULL

Used for thread message ordering

The message `content` column contains a JSON object conforming to the `MastraMessageContentV2` type, which is designed to align closely with the AI SDK `UIMessage` message shape.

format

integer

NOT NULL

Message format version (currently 2)

parts

array (JSON)

NOT NULL

Array of message parts (text, tool-invocation, file, reasoning, etc.). The structure of items in this array varies by `type`.

experimental\_attachments

array (JSON)

CAN BE NULL

Optional array of file attachments

content

text

CAN BE NULL

Optional main text content of the message

toolInvocations

array (JSON)

CAN BE NULL

Optional array summarizing tool calls and results

reasoning

object (JSON)

CAN BE NULL

Optional information about the reasoning process behind the assistant's response

annotations

object (JSON)

CAN BE NULL

Optional additional metadata or annotations

### Threads

Groups related messages together and associates them with a resource. Contains metadata about the conversation.

id

uuidv4

PRIMARYKEY

NOT NULL

Unique identifier for the thread (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

resourceId

text

NOT NULL

Primary identifier of the external resource this thread is associated with. Used to group and retrieve related threads.

title

text

NOT NULL

Title of the conversation thread

metadata

text

Custom thread metadata as stringified JSON. Example:

```nextra-code

```

createdAt

timestamp

NOT NULL

updatedAt

timestamp

NOT NULL

Used for thread ordering history

### Resources

Stores user-specific data for resource-scoped working memory. Each resource represents a user or entity, allowing working memory to persist across all conversation threads for that user.

id

text

PRIMARYKEY

NOT NULL

Resource identifier (user or entity ID) - same as resourceId used in threads and agent calls

workingMemory

text

CAN BE NULL

Persistent working memory data as Markdown text. Contains user profile, preferences, and contextual information that persists across conversation threads.

metadata

jsonb

CAN BE NULL

Additional resource metadata as JSON. Example:

```nextra-code

```

createdAt

timestamp

NOT NULL

When the resource record was first created

updatedAt

timestamp

NOT NULL

When the working memory was last updated

**Note**: This table is only created and used by storage adapters that support resource-scoped working memory (LibSQL, PostgreSQL, Upstash). Other storage adapters will provide helpful error messages if resource-scoped memory is attempted.

### Workflows

When `suspend` is called on a workflow, its state is saved in the following format. When `resume` is called, that state is rehydrated.

workflow\_name

text

NOT NULL

Name of the workflow

run\_id

uuidv4

NOT NULL

Unique identifier for the workflow execution. Used to track state across suspend/resume cycles (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

snapshot

text

NOT NULL

Serialized workflow state as JSON. Example:

```nextra-code

```

createdAt

timestamp

NOT NULL

updatedAt

timestamp

NOT NULL

Last modification time, used to track state changes during workflow execution

### Eval Datasets

Stores eval results from running metrics against agent outputs.

input

text

NOT NULL

Input provided to the agent

output

text

NOT NULL

Output generated by the agent

result

jsonb

NOT NULL

Eval result data that includes score and details. Example:

```nextra-code

```

agent\_name

text

NOT NULL

metric\_name

text

NOT NULL

e.g Faithfulness, Hallucination, etc.

instructions

text

NOT NULL

System prompt or instructions for the agent

test\_info

jsonb

NOT NULL

Additional test metadata and configuration

global\_run\_id

uuidv4

NOT NULL

Groups related evaluation runs (e.g. all unit tests in a CI run)

run\_id

uuidv4

NOT NULL

Unique identifier for the run being evaluated (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

created\_at

timestamp

NOT NULL

### Traces

Captures OpenTelemetry traces for monitoring and debugging.

id

text

NOT NULL

PRIMARYKEY

Unique trace identifier

parentSpanId

text

ID of the parent span. Null if span is top level

name

text

NOT NULL

Hierarchical operation name (e.g. `workflow.myWorkflow.execute`, `http.request`, `database.query`)

traceId

text

NOT NULL

Root trace identifier that groups related spans

scope

text

NOT NULL

Library/package/service that created the span (e.g. `@mastra/core`, `express`, `pg`)

kind

integer

NOT NULL

`INTERNAL` (0, within process), `CLIENT` (1, outgoing calls), `SERVER` (2, incoming calls), `PRODUCER` (3, async job creation), `CONSUMER` (4, async job processing)

attributes

jsonb

User defined key-value pairs that contain span metadata

status

jsonb

JSON object with `code` (UNSET=0, ERROR=1, OK=2) and optional `message`. Example:

```nextra-code

```

events

jsonb

Time-stamped events that occurred during the span

links

jsonb

Links to other related spans

other

text

Additional OpenTelemetry span fields as stringified JSON. Example:

```nextra-code

```

startTime

bigint

NOT NULL

Nanoseconds since Unix epoch when span started

endTime

bigint

NOT NULL

Nanoseconds since Unix epoch when span ended

createdAt

timestamp

NOT NULL

### Querying Messages [Permalink for this section](https://mastra.ai/en/docs/server-db/storage\#querying-messages)

Messages are stored in a V2 format internally, which is roughly equivalent to the AI SDK’s `UIMessage` format. When querying messages using `getMessages`, you can specify the desired output format, defaulting to `v1` for backwards compatibility:

```nextra-code

// Get messages in the default V1 format (roughly equivalent to AI SDK's CoreMessage format)
const messagesV1 = await mastra.getStorage().getMessages({ threadId: 'your-thread-id' });

// Get messages in the V2 format (roughly equivalent to AI SDK's UIMessage format)
const messagesV2 = await mastra.getStorage().getMessages({ threadId: 'your-thread-id', format: 'v2' });
```

You can also retrieve messages using an array of message IDs. Note that unlike `getMessages`, this defaults to the V2 format:

```nextra-code

const messagesV1 = await mastra.getStorage().getMessagesById({ messageIds: messageIdArr, format: 'v1' });

const messagesV2 = await mastra.getStorage().getMessagesById({ messageIds: messageIdArr });
```

## Storage Providers [Permalink for this section](https://mastra.ai/en/docs/server-db/storage\#storage-providers)

Mastra supports the following providers:

- For local development, check out [LibSQL Storage](https://mastra.ai/en/reference/storage/libsql)
- For production, check out [PostgreSQL Storage](https://mastra.ai/en/reference/storage/postgresql)
- For serverless deployments, check out [Upstash Storage](https://mastra.ai/en/reference/storage/upstash)

[Custom API Routes](https://mastra.ai/en/docs/server-db/custom-api-routes "Custom API Routes") [Snapshots](https://mastra.ai/en/docs/server-db/snapshots "Snapshots")