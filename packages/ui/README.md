# @alfred/ui

Shared React primitives for ALFRED chat and domain panes.

## Responsibilities

- Present assistant/orchestrator conversations with AI SDK `UIMessage` data (`Chat`).
- Provide lightweight panes for notes, reminders, and home control summaries.
- Remain framework-agnostic so apps/web and apps/native can share the same render contracts.

## Usage

```tsx
import { Chat } from "@alfred/ui";

<Chat messages={messages} onSend={sendMessage} />;
```

Consumers are responsible for styling; the components emit semantic class names but no CSS.

## Next Steps

- Add visual regression tests once styling tokens are finalised.
- Expand pane coverage for timers, bookmarks, and policy prompts.
- Consider storybook snapshots for design validation in Phase 2.
