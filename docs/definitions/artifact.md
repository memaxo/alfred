# Artifact

An artifact is a persisted file output from a tool call. Artifacts are stored in `.agent/tools/{category}/{tool}.{format}` and serve as the context handoff mechanism between agent iterations.

## Purpose

Artifacts enable "context folding"—sub-agents do work and return results as files. The main agent reads artifact files rather than holding all context in the window. This pattern allows effectively infinite context without window bloat.

Without artifacts, every piece of context must live in the message history, which:

- Consumes expensive tokens
- Accumulates noise and drift
- Cannot survive process restarts
- Must be fully processed on every LLM call

With artifacts, agents operate like humans with a filing cabinet: they know where to look, they retrieve what they need, and they put things back for future reference.

## File Formats

- `.json` — Structured data, queryable, machine-readable. Use for tool outputs that will be parsed.
- `.md` — Human-readable summaries, status reports. Use for context meant to be read by agents or humans.
- `.log` — Execution traces, debugging information. Use for audit trails and troubleshooting.
- `.txt` — Plain text outputs. Use for simple text content.

The format is determined by the tool's `outputFormat` annotation.

## Directory Structure

```
.agent/
├── tools/
│   ├── CATALOG.md           # Auto-generated tool listing
│   ├── rag/
│   │   ├── query.json       # Most recent query result
│   │   └── documents.json   # Document list
│   ├── mcp/
│   │   └── STATUS.md        # MCP server status
│   ├── knowledge/
│   │   └── state.json       # Knowledge graph snapshot
│   └── cognitive/
│       └── state.json       # Cognitive state
└── audit/
    └── {timestamp}.jsonl    # Tool call audit trail
```

## Lifecycle

1. Agent calls tool
2. Tool executes and produces result
3. Persistence wrapper writes result to artifact file
4. Result also recorded to AgentFS SQLite for audit
5. Next agent iteration can read artifact file

Artifacts are not automatically cleaned up. They persist until explicitly deleted or the workspace is reset. This is intentional—artifacts represent accumulated context that may be valuable across many iterations.

## Artifact vs SQLite

ALFRED stores tool outputs in two places:

**AgentFS SQLite (`tool_calls` table)**

- Structured audit trail
- Queryable by tool name, time range, success/failure
- Used for learning and pattern analysis
- Internal format (JSON blobs)

**Artifact files (`.agent/tools/`)**

- Human-readable output
- Directly readable by agents
- Format optimized for consumption
- Used for context handoff

Both are written on tool execution. SQLite is for machines; artifacts are for agents and humans.

## Best Practices

**Write meaningful artifacts.** An artifact should contain everything an agent needs to understand the result. Include metadata, timestamps, and summaries where helpful.

**Use appropriate formats.** JSON for structured data that will be parsed. Markdown for status and summaries. Don't force everything into one format.

**Consider freshness.** Some artifacts go stale quickly (MCP status, temporal context). Others remain valid indefinitely (query results, extracted facts). Design tools to indicate freshness where relevant.

**Keep artifacts focused.** One artifact per tool output. Don't combine unrelated outputs into a single file. This makes selective reading easier.

## Related Concepts

- **context** — The five types of information available to agents
- **tool** — Capabilities that produce artifacts
- **handoff** — How artifacts enable context transfer
