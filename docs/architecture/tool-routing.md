# Tool Routing and Capability Parity

**Owner:** agent  
**Status:** Implemented (2026-01-28)

## Purpose

Ensure every backend capability is reachable by both human UI and agent tools, while maintaining AI SDK v6 hygiene (≤5 tools per agent).

## Architecture

```
User Request → Intent Classification → Tool Catalog → AI SDK Agent
                    ↑
            LLM + Heuristic Fallback
```

### Intent Categories

| Category       | Tools                     | Capabilities                 |
| -------------- | ------------------------- | ---------------------------- |
| personal       | note, remind, timer       | note.create, reminder.create |
| voice          | voiceStatus, voiceControl | voice.call                   |
| code_edit      | codex, opencode           | code.edit                    |
| code_review    | codex, opencode           | (shares tools)               |
| git            | git                       | git.operation                |
| deploy         | docker                    | deploy.preview               |
| infrastructure | docker                    | docker.manage                |
| knowledge      | knowledgeQuery, ragQuery  | knowledge.query, rag.search  |
| workflow       | handoff, droid            | workflow.run, agentfs.export |
| handoff        | handoff, droid            | (escalation)                 |

### Capability Parity Rules

1. **Tool coverage required.** Every capability must have either:
   - Tool implementation (via routing catalog)
   - `uiOnly: true` marker (human-only admin actions)

2. **Catalog size limit.** Maximum 5 tools per catalog. Exceeding degrades model performance.

3. **Classification approach.** Use LLM with structured output (Zod schema) + heuristic fallback for offline mode.

## Implementation

- **Routing:** `packages/agent/src/routing/intent.ts`
- **Registry:** `packages/agent/src/capability.ts`
- **Tests:** `packages/agent/test/capability-parity.test.ts`

## Enforcement

Tests fail if:

- Any capability lacks tool coverage without `uiOnly` marker
- Any catalog exceeds 5 tools
- Importing routing module causes side effects

## See Also

- `.ruler/64-tool-routing.md` — Detailed rules
- `.ruler/55-llm-first-classification.md` — Classification patterns
- `.ruler/15-ai-sdk-v6.md` — Tool hygiene requirements
