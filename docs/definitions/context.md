# Context

Context is information available to an agent at execution time. ALFRED distinguishes five context types to enable precise reasoning about what information agents have and need.

## Window Context

The tokens currently in the LLM's context window. This includes the system prompt, message history, and any injected data. Window context is ephemeral—it exists only for the duration of a single LLM call and resets between agent iterations.

Window context is the most constrained resource. It has a fixed token limit and accumulates "drift" over long conversations. ALFRED combats drift by using fresh starts between iterations and offloading persistent information to artifact context.

## Artifact Context

Persisted file outputs from previous tool calls. Stored in `.agent/tools/` as JSON, Markdown, or other human-readable formats. Artifacts are the primary context handoff mechanism between agent iterations.

Key property: Artifacts exist outside the window context until explicitly read. An agent can have access to gigabytes of artifact context but only load the relevant portions into its window when needed. This enables "context folding"—sub-agents do work and return results as artifacts; the main agent reads artifacts selectively.

## Domain Context

Knowledge about entities and their relationships. Includes the knowledge graph (`packages/knowledge/`), facts extracted from conversations, and entity metadata. Domain context is accessed via knowledge tools; results are persisted as artifacts.

Domain context answers "what does ALFRED know about X?" It's the accumulated understanding from all prior interactions, stored durably in the knowledge graph and queryable on demand.

## Environmental Context

System state including MCP server status, runtime health, cognitive state, and resource availability. Represented in `.agent/tools/mcp/STATUS.md` and similar status files.

Environmental context tells agents what capabilities are currently available. If an MCP server is disconnected, agents reading STATUS.md know not to call those tools. If the system is under load, agents can adjust behavior.

## Temporal Context

Time-sensitive information: upcoming reminders, active timers, calendar events, deadlines. Temporal context changes based on current time—a reminder that's due in 5 minutes is more relevant than one due next week.

Temporal context requires special handling because it decays. An artifact written yesterday may contain stale temporal information. Status tools that provide temporal context should be called fresh rather than relying on cached artifacts.

## Self-Discovery Principle

Agents identify context gaps by reading artifacts and reasoning, not by calling programmatic gap detection functions. This is a core architectural principle.

The CATALOG.md file lists available tools and what context they provide. An agent reasons:

1. "I need to know about the user's recent notes"
2. "I don't see a notes artifact in `.agent/tools/`"
3. "CATALOG.md shows `note_list` provides note context"
4. "I should call `note_list` to fill this gap"

This reasoning happens in the LLM, not in hardcoded gap detection logic. The file system is the shared memory; reading and reasoning is the discovery mechanism.

## Related Concepts

- **artifact** — The persistence mechanism for context handoff
- **tool** — Capabilities that produce context
- **handoff** — How context transfers between agents
