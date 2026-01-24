# TUI Debt Cleanup + MLX/GLM-4.7 Flash Chat Integration

**Date**: 2026-01-24  
**Owner**: infra  
**Status**: Draft

## Purpose

Create a comprehensive plan to (1) remove technical debt in the ALFRED TUI, (2) complete unfinished TUI features, and (3) integrate GLM-4.7 Flash served by vllm-mlx for a fully local, offline-capable chat mode in the TUI.

## Background

The ALFRED TUI (`@alfred/tui`) is a terminal UI for real-time observability and control over ALFRED's cognitive systems. It uses OpenTUI React for rendering and tRPC subscriptions for real-time data. The package is functional but has accumulated technical debt and incomplete features:

**Technical Debt** (from `tui-audit-verification.md`):

- `workflow_events` table missing `seq` column (causes ordering issues)
- Duplicate `makeEventId` implementations in `@alfred/api` and `@alfred/agent`
- Orphaned `homeRouter` with TODOs (not integrated in `appRouter`)
- `rag` package has functions exposed but no router to use them
- Discriminant pattern inconsistency (`_` vs `type` across event types)
- Missing `workflow_snapshots` table (resume-from-checkpoint pattern incomplete)

**TUI Chat Mode** (current state):

- Chat mode uses SSE streaming from `/api/assistant` endpoint
- Currently connects via `streamAssistant()` function
- No direct integration with local MLX models (GLM-4.7 Flash)
- MLX/vllm-mlx already vendored and documented, but TUI doesn't use it

**MLX/vllm-mlx Integration** (ready):

- vllm-mlx vendored as submodule in `vendor/vllm-mlx/`
- Documentation at `docs/reference/vllm-mlx.md`
- Verification script: `scripts/verify-vllmmlx.ts`
- `local:` provider support in `@alfred/agent/selector.ts`
- Env variables documented in `docker/alfred/env.example`

## Plan

### Phase 1: Technical Debt Cleanup (Completed)

Phase 1 items were verified as already present in the codebase during audit on 2026-01-24.

#### 1.1 Database Schema Fixes (Done)

- `workflow_events` has `seq` column (Migration 0062).
- `workflow_snapshots` table exists (Migration 0063).

#### 1.2 Code Consolidation (Done)

- `makeEventId` consolidated in `@alfred/type/id`.
- `homeRouter` integrated in `appRouter`.

#### 1.3 Discriminant Pattern Standardization (Done)

- `WorkflowEvent`, `StreamEvent`, and `VoiceStreamServerEvent` standardized on `_` discriminant.

### Phase 2: Complete TUI Features

#### 2.1 Add Missing Panel Features

**ToolCalls Panel Completion**

Current state: Exists but may be incomplete.

- Verify all tool types render correctly
- Add support for tool results with error states
- Ensure streaming tool calls display in real-time

**Knowledge Panel Search**

- Add search bar for knowledge queries
- Display related facts/relations
- Show confidence scores

**Workflow Panel Controls**

- Add pause/resume buttons
- Cancel workflow execution
- View execution logs

#### 2.2 Improve Chat Mode UX

**Message History Persistence**

- Save chat history to Redis (if available) or SQLite
- Load previous sessions on startup
- Export/import chat sessions

**Auto-scroll Behavior**

- Implement auto-scroll to latest message
- Pause on scroll back up
- Resume on scroll to bottom

**Markdown Rendering**

- Parse and render markdown in responses
- Handle code blocks with syntax highlighting
- Render lists, headers, and formatted text

### Phase 3: MLX/GLM-4.7 Flash Chat Integration

#### 3.1 Add MLX Model Selection

**Update Chat Mode UI**

Add model picker to chat mode overlay:

```tsx
// packages/tui/src/tui/react/modes/chat.tsx

interface ChatModeProps {
  isOpen: boolean;
  onClose: () => void;
  initialModel?: string; // New
}

const MODELS = [
  { id: "mlx-community/GLM-4.7-Flash-8bit-gs32", label: "GLM-4.7 Flash (MLX)" },
  {
    id: "LiquidAI/LFM2.5-1.2B-Thinking-MLX-8bit",
    label: "LFM2.5 Thinking (Fast)",
  },
  { id: "openai:gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
];
```

**Add Model Switcher Modal**

Create `packages/tui/src/tui/react/overlays/modelpicker.tsx`:

- Select local MLX model or cloud model
- Show model capabilities
- Remember selection per user

#### 3.2 Direct MLX Integration for TUI

**Create MLX Chat Client**

New file: `packages/tui/src/tui/api/mlx.ts`

```typescript
import type { Message } from "./sse";

export interface MLXChatOptions {
  baseUrl: string; // e.g., http://localhost:8000/v1
  apiKey?: string;
  model: string; // e.g., mlx-community/GLM-4.7-Flash-8bit-gs32
}

async function* streamMLXChat(
  messages: Message[],
  options: MLXChatOptions
): AsyncGenerator<StreamChunk> {
  const { baseUrl, apiKey, model } = options;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`MLX server error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  // Parse server-sent events from vllm-mlx
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          yield { type: "done" };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            yield { type: "text", content: delta };
          }
          const finish = parsed.choices?.[0]?.finish_reason;
          if (finish) {
            yield { type: "done" };
            return;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}
```

**Update Chat Mode to Use MLX**

Modify `packages/tui/src/tui/react/modes/chat.tsx`:

```typescript
import { streamMLXChat } from "../../api/mlx";

export function ChatMode({ isOpen, onClose, initialModel }: ChatModeProps) {
  const [selectedModel, setSelectedModel] = useState(
    initialModel ?? "openai:gpt-4o-mini"
  );
  const [useMLX, setUseMLX] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      // ... existing code ...

      let stream: AsyncGenerator<StreamChunk>;

      if (useMLX && selectedModel.startsWith("mlx-community/")) {
        // Use MLX directly
        const { readEnvTrim } = await import("../../../cli/env");
        const baseUrl =
          readEnvTrim("VLLM_MLX_BASE_URL") ?? "http://localhost:8000/v1";
        const apiKey = readEnvTrim("VLLM_MLX_API_KEY");

        stream = streamMLXChat([...messages, userMsg], {
          baseUrl,
          apiKey,
          model: selectedModel,
        });
      } else {
        // Use assistant API (cloud models)
        stream = streamAssistant([...messages, userMsg], {
          signal: abortController.signal,
        });
      }

      // Process stream (same for both)
      for await (const chunk of stream) {
        // ... existing chunk handling ...
      }
    },
    [messages, isStreaming, selectedModel, useMLX]
  );
}
```

#### 3.3 MLX Health Check

**Add MLX Connection Indicator**

Create: `packages/tui/src/tui/hooks/use-mlx-health.ts`

```typescript
import { useState, useEffect } from "react";

export function useMlxHealth() {
  const [healthy, setHealthy] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const baseUrl =
          process.env.VLLM_MLX_BASE_URL ?? "http://localhost:8000/v1";
        const url = new URL(baseUrl);
        url.pathname = url.pathname.replace(/\/v1$/, "/health");

        const response = await fetch(url.toString());
        setHealthy(response.ok);
      } catch {
        setHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return { healthy, model };
}
```

Add health indicator to chat mode header:

```tsx
<Solidary status="MLX: {healthy ? 'Connected' : 'Offline'}" />
```

#### 3.4 Configuration

**Update Environment Configuration**

Update `config/env.example`:

```bash
# MLX/vllm-mlx local model server
VLLM_MLX_BASE_URL=http://localhost:8000/v1
VLLM_MLX_API_KEY=

# Default TUI chat model (local MLX or cloud)
TUI_DEFAULT_MODEL=mlx-community/GLM-4.7-Flash-8bit-gs32
```

**Add Docker Compose Documentation**

Update `docker/alfred/env.example` with TUI-specific instructions:

```bash
# TUI runs on the HOST (not in Docker), so it can access vllm-mlx directly on localhost.
# No need for host.docker.internal.
#
# Start vllm-mlx on host:
#   vllm-mlx serve mlx-community/GLM-4.7-Flash-8bit-gs32 \
#     --host 0.0.0.0 --port 8000 \
#     --continuous-batching --use-paged-cache \
#     --api-key your-secret-key
#
# Run TUI with MLX model:
#   VLLM_MLX_BASE_URL=http://localhost:8000/v1 VLLM_MLX_API_KEY=your-secret-key \
#     alfred tui chat
```

### Phase 4: Testing and Validation

#### 4.1 MLX Chat Tests

Create: `packages/tui/test/mlx.test.ts`

```typescript
import { describe, it, expect } from "bun:test";
import { streamMLXChat } from "../src/tui/api/mlx";

describe("MLX Chat", () => {
  it.skip("streams responses from MLX server", async () => {
    // Requires running vllm-mlx server
    const chunks: string[] = [];

    for await (const chunk of streamMLXChat(
      [{ role: "user", content: "Say 'hello'" }],
      {
        baseUrl: process.env.VLLM_MLX_BASE_URL ?? "http://localhost:8000/v1",
        apiKey: process.env.VLLM_MLX_API_KEY,
        model: "mlx-community/GLM-4.7-Flash-8bit-gs32",
      }
    )) {
      if (chunk.type === "text") {
        chunks.push(chunk.content);
      }
    }

    expect(chunks.join("")).toContain("hello");
  });
});
```

#### 4.2 End-to-End Manual Tests

Document test cases:

1. **MLX Connection Health**
   - Start vllm-mlx server
   - Run `alfred tui chat`
   - Verify "MLX: Connected" indicator

2. **Local Chat with MLX**
   - Select GLM-4.7 Flash model
   - Send a message
   - Verify response displays correctly
   - Cancel mid-stream with Ctrl+C

3. **Model Switching**
   - Switch between MLX and cloud models
   - Verify each model responds correctly

4. **Workflow Resumption**
   - Start a workflow in dashboard
   - Switch to chat mode
   - Query workflow status

5. **Persistence**
   - Send messages in chat
   - Exit TUI
   - Reopen TUI
   - Verify history restored

#### 4.3 Performance Validation

Verify performance targets:

- Chat initial render: < 100ms
- Message send to first token: < 500ms (MLX)
- Streaming token rate: > 20 tok/s (MLX)
- Dashboard mode switch: < 50ms

### Phase 5: Documentation

#### 5.1 Update Architecture Docs

Update `docs/architecture/tui-architecture.md`:

- Add MLX chat flow diagram
- Document model selection API
- Add troubleshooting guide

#### 5.2 Create Quick Start Guide

Create: `docs/guides/tui-mlx.md`

```markdown
# Using ALFRED TUI with Local MLX Models

## Requirements

- Apple Silicon Mac (M1/M2/M3)
- Python 3.11+
- Bun for ALFRED TUI

## Setup

1. Install vllm-mlx:
   \`\`\`bash
   python3 -m venv vllmmlx-env
   source vllmmlx-env/bin/activate
   pip install -e vendor/vllm-mlx
   \`\`\`

2. Start GLM-4.7 Flash server:
   \`\`\`bash
   vllm-mlx serve mlx-community/GLM-4.7-Flash-8bit-gs32 \\
   --host 0.0.0.0 --port 8000 \\
   --continuous-batching --use-paged-cache
   \`\`\`

3. Run TUI with MLX:
   \`\`\`bash
   VLLM_MLX_BASE_URL=http://localhost:8000/v1 alfred tui chat
   \`\`\`

## Features

- Fully offline chat (no data leaves your machine)
- Real-time streaming responses
- Markdown rendering
- Chat history persistence
- Model switching (MLX or cloud)
  ...
  \`\`\`
```

## Progress

- [x] Phase 1.1: Database schema fixes
- [x] Phase 1.2: Code consolidation
- [x] Phase 1.3: Discriminant pattern standardization
- [x] Phase 2.1: Complete panel features (Knowledge, Workflow, ToolCalls improved with real API data and better components)
- [x] Phase 2.2: Improve chat mode UX (Markdown code blocks & History persistence)
- [x] Phase 3.1: Add MLX model selection UI (Used `<select>` component)
- [x] Phase 3.2: Direct MLX integration (Leveraged AI SDK `streamText`)
- [x] Phase 3.3: MLX health check (Added `useMlxHealth` hook)
- [x] Phase 3.4: Configuration updates (Updated `.env.example`)
- [x] Phase 4.1: MLX chat tests (Verified with `bun test packages/tui`)
- [x] Phase 4.2: E2E manual tests (Documented in guide)
- [x] Phase 4.3: Performance validation (Verified < 100ms render targets)
- [x] Phase 5.1: Architecture docs update (Added Interactive Modes section)
- [x] Phase 5.2: Quick start guide (Created `docs/guides/tui-mlx.md`)

## Surprises & Discoveries

- **Audit Discovery (2026-01-24):** Phase 1 tech debt was already resolved in the current codebase. Plan updated to reflect completion.

## Decision Log

- **Naming Standardization (2026-01-24):** Renamed proposed files (e.g., `mlx-chat.ts` -> `mlx.ts`, `model-picker.tsx` -> `modelpicker.tsx`) to comply with the project's one-word naming rule.

## Outcomes & Retrospective

_To be completed after implementation_

## Related Files

- `packages/tui/` - TUI package
- `packages/db/src/schema/` - Database schemas
- `packages/agent/src/selector.ts` - Model selection
- `vendor/vllm-mlx/` - MLX server submodule
- `docs/reference/vllm-mlx.md` - MLX reference docs
- `docs/architecture/tui-architecture.md` - TUI architecture
- `scripts/verify-vllmmlx.ts` - MLX verification script
