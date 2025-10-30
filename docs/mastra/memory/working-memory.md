---
title: Working Memory | Memory | Mastra Docs
url: 
description: Learn how to configure working memory in Mastra to store persistent user data, preferences.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/memory/working-memory#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Memory](https://mastra.ai/en/docs/memory/overview "Memory") Working Memory

Copy page

# Working Memory

While [conversation history](https://mastra.ai/docs/memory/overview#conversation-history) and [semantic recall](https://mastra.ai/en/docs/memory/semantic-recall) help agents remember conversations, working memory allows them to maintain persistent information about users across interactions.

Think of it as the agent’s active thoughts or scratchpad – the key information they keep available about the user or task. It’s similar to how a person would naturally remember someone’s name, preferences, or important details during a conversation.

This is useful for maintaining ongoing state that’s always relevant and should always be available to the agent.

Working memory can persist at two different scopes:

- **Thread-scoped** (default): Memory is isolated per conversation thread
- **Resource-scoped**: Memory persists across all conversation threads for the same user

**Important:** Switching between scopes means the agent won’t see memory from the other scope - thread-scoped memory is completely separate from resource-scoped memory.

## Quick Start [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#quick-start)

Here’s a minimal example of setting up an agent with working memory:

```nextra-code

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create agent with working memory enabled
const agent = new Agent({
  name: "PersonalAssistant",
  instructions: "You are a helpful personal assistant.",
  model: openai("gpt-4o"),
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
});
```

## How it Works [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#how-it-works)

Working memory is a block of Markdown text that the agent is able to update over time to store continuously relevant information:

Build AI Agents with human-like memory using Mastra (working memory) - YouTube

[Photo image of Mastra AI](https://www.youtube.com/channel/UCTYjNDUYsrt7DrwU11fdyhQ?embeds_referring_euri=https%3A%2F%2Fmastra.ai%2F)

Mastra AI

3.63K subscribers

[Build AI Agents with human-like memory using Mastra (working memory)](https://www.youtube.com/watch?v=UMy_JHLf1n8)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/
•Live

•

## Memory Persistence Scopes [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#memory-persistence-scopes)

Working memory can operate in two different scopes, allowing you to choose how memory persists across conversations:

### Thread-Scoped Memory (Default) [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#thread-scoped-memory-default)

By default, working memory is scoped to individual conversation threads. Each thread maintains its own isolated memory:

```nextra-code

const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'thread', // Default - memory is isolated per thread
      template: `# User Profile
- **Name**:
- **Interests**:
- **Current Goal**:
`,
    },
  },
});
```

**Use cases:**

- Different conversations about separate topics
- Temporary or session-specific information
- Workflows where each thread needs working memory but threads are ephemeral and not related to each other

### Resource-Scoped Memory [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#resource-scoped-memory)

Resource-scoped memory persists across all conversation threads for the same user (resourceId), enabling persistent user memory:

```nextra-code

const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource', // Memory persists across all user threads
      template: `# User Profile
- **Name**:
- **Location**:
- **Interests**:
- **Preferences**:
- **Long-term Goals**:
`,
    },
  },
});
```

**Use cases:**

- Personal assistants that remember user preferences
- Customer service bots that maintain customer context
- Educational applications that track student progress

### Usage with Agents [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#usage-with-agents)

When using resource-scoped memory, make sure to pass the `resourceId` parameter:

```nextra-code

// Resource-scoped memory requires resourceId
const response = await agent.generate("Hello!", {
  threadId: "conversation-123",
  resourceId: "user-alice-456" // Same user across different threads
});
```

## Storage Adapter Support [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#storage-adapter-support)

Resource-scoped working memory requires specific storage adapters that support the `mastra_resources` table:

### ✅ Supported Storage Adapters [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#-supported-storage-adapters)

- **LibSQL** ( `@mastra/libsql`)
- **PostgreSQL** ( `@mastra/pg`)
- **Upstash** ( `@mastra/upstash`)

## Custom Templates [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#custom-templates)

Templates guide the agent on what information to track and update in working memory. While a default template is used if none is provided, you’ll typically want to define a custom template tailored to your agent’s specific use case to ensure it remembers the most relevant information.

Here’s an example of a custom template. In this example the agent will store the users name, location, timezone, etc as soon as the user sends a message containing any of the info:

```nextra-code

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `
# User Profile

## Personal Info

- Name:
- Location:
- Timezone:

## Preferences

- Communication Style: [e.g., Formal, Casual]
- Project Goal:
- Key Deadlines:
  - [Deadline 1]: [Date]
  - [Deadline 2]: [Date]

## Session State

- Last Task Discussed:
- Open Questions:
  - [Question 1]
  - [Question 2]
`,
    },
  },
});
```

## Designing Effective Templates [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#designing-effective-templates)

A well-structured template keeps the information easy for the agent to parse and update. Treat the
template as a short form that you want the assistant to keep up to date.

- **Short, focused labels.** Avoid paragraphs or very long headings. Keep labels brief (for example
`## Personal Info` or `- Name:`) so updates are easy to read and less likely to be truncated.
- **Use consistent casing.** Inconsistent capitalization ( `Timezone:` vs `timezone:`) can cause messy
updates. Stick to Title Case or lower case for headings and bullet labels.
- **Keep placeholder text simple.** Use hints such as `[e.g., Formal]` or `[Date]` to help the LLM
fill in the correct spots.
- **Abbreviate very long values.** If you only need a short form, include guidance like
`- Name: [First name or nickname]` or `- Address (short):` rather than the full legal text.
- **Mention update rules in `instructions`.** You can instruct how and when to fill or clear parts of
the template directly in the agent’s `instructions` field.

### Alternative Template Styles [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#alternative-template-styles)

Use a shorter single block if you only need a few items:

```nextra-code

const basicMemory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `User Facts:\n- Name:\n- Favorite Color:\n- Current Topic:`,
    },
  },
});
```

You can also store the key facts in a short paragraph format if you prefer a more narrative style:

```nextra-code

const paragraphMemory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `Important Details:\n\nKeep a short paragraph capturing the user's important facts (name, main goal, current task).`,
    },
  },
});
```

## Structured Working Memory [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#structured-working-memory)

Working memory can also be defined using a structured schema instead of a Markdown template. This allows you to specify the exact fields and types that should be tracked, using a [Zod](https://zod.dev/) schema. When using a schema, the agent will see and update working memory as a JSON object matching your schema.

**Important:** You must specify either `template` or `schema`, but not both.

### Example: Schema-Based Working Memory [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#example-schema-based-working-memory)

```nextra-code

import { z } from 'zod';
import { Memory } from '@mastra/memory';

const userProfileSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  preferences: z.object({
    communicationStyle: z.string().optional(),
    projectGoal: z.string().optional(),
    deadlines: z.array(z.string()).optional(),
  }).optional(),
});

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      schema: userProfileSchema,
      // template: ... (do not set)
    },
  },
});
```

When a schema is provided, the agent receives the working memory as a JSON object. For example:

```nextra-code

{
  "name": "Sam",
  "location": "Berlin",
  "timezone": "CET",
  "preferences": {
    "communicationStyle": "Formal",
    "projectGoal": "Launch MVP",
    "deadlines": ["2025-07-01"]
  }
}
```

## Choosing Between Template and Schema [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#choosing-between-template-and-schema)

- Use a **template** (Markdown) if you want the agent to maintain memory as a free-form text block, such as a user profile or scratchpad.
- Use a **schema** if you need structured, type-safe data that can be validated and programmatically accessed as JSON.
- Only one mode can be active at a time: setting both `template` and `schema` is not supported.

## Example: Multi-step Retention [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#example-multi-step-retention)

Below is a simplified view of how the `User Profile` template updates across a short user
conversation:

```nextra-code

# User Profile

## Personal Info

- Name:
- Location:
- Timezone:

--- After user says "My name is **Sam** and I'm from **Berlin**" ---

# User Profile
- Name: Sam
- Location: Berlin
- Timezone:

--- After user adds "By the way I'm normally in **CET**" ---

# User Profile
- Name: Sam
- Location: Berlin
- Timezone: CET
```

The agent can now refer to `Sam` or `Berlin` in later responses without requesting the information
again because it has been stored in working memory.

If your agent is not properly updating working memory when you expect it to, you can add system
instructions on _how_ and _when_ to use this template in your agent’s `instructions` setting.

## Setting Initial Working Memory [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#setting-initial-working-memory)

While agents typically update working memory through the `updateWorkingMemory` tool, you can also set initial working memory programmatically when creating or updating threads. This is useful for injecting user data (like their name, preferences, or other info) that you want available to the agent without passing it in every request.

### Setting Working Memory via Thread Metadata [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#setting-working-memory-via-thread-metadata)

When creating a thread, you can provide initial working memory through the metadata’s `workingMemory` key:

src/app/medical-consultation.ts

```nextra-code [counter-reset:line]

// Create a thread with initial working memory
const thread = await memory.createThread({
  threadId: "thread-123",
  resourceId: "user-456",
  title: "Medical Consultation",
  metadata: {
    workingMemory: `# Patient Profile
- Name: John Doe
- Blood Type: O+
- Allergies: Penicillin
- Current Medications: None
- Medical History: Hypertension (controlled)
`
  }
});

// The agent will now have access to this information in all messages
await agent.generate("What's my blood type?", {
  threadId: thread.id,
  resourceId: "user-456"
});
// Response: "Your blood type is O+."
```

### Updating Working Memory Programmatically [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#updating-working-memory-programmatically)

You can also update an existing thread’s working memory:

src/app/medical-consultation.ts

```nextra-code [counter-reset:line]

// Update thread metadata to add/modify working memory
await memory.updateThread({
  id: "thread-123",
  title: thread.title,
  metadata: {
    ...thread.metadata,
    workingMemory: `# Patient Profile
- Name: John Doe
- Blood Type: O+
- Allergies: Penicillin, Ibuprofen  // Updated
- Current Medications: Lisinopril 10mg daily  // Added
- Medical History: Hypertension (controlled)
`
  }
});
```

### Direct Memory Update [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#direct-memory-update)

Alternatively, use the `updateWorkingMemory` method directly:

src/app/medical-consultation.ts

```nextra-code [counter-reset:line]

await memory.updateWorkingMemory({
  threadId: "thread-123",
  resourceId: "user-456", // Required for resource-scoped memory
  workingMemory: "Updated memory content..."
});
```

## Examples [Permalink for this section](https://mastra.ai/en/docs/memory/working-memory\#examples)

- [Basic working memory](https://mastra.ai/examples/memory/working-memory-basic)
- [Working memory with template](https://mastra.ai/examples/memory/working-memory-template)
- [Working memory with schema](https://mastra.ai/examples/memory/working-memory-schema)
- [Per-resource working memory](https://github.com/mastra-ai/mastra/tree/main/examples/memory-per-resource-example) \- Complete example showing resource-scoped memory persistence

[Threads and Resources](https://mastra.ai/en/docs/memory/threads-and-resources "Threads and Resources") [Conversation History](https://mastra.ai/en/docs/memory/conversation-history "Conversation History")