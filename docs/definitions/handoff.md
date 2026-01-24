# Handoff

Handoff is the transfer of context between agents. In ALFRED, handoff occurs via artifacts, not direct communication. This is a fundamental architectural choice.

## Artifact-Based Handoff

The handoff flow:

1. Agent A completes work
2. Agent A writes artifact to `.agent/tools/`
3. Agent A terminates (or continues to next task)
4. Agent B starts with fresh window context
5. Agent B reads relevant artifacts
6. Agent B continues work with transferred context

No messages pass directly between agents. The file system is the communication channel.

## Why Artifacts?

**Fresh starts.** Each agent iteration begins with a clean window context. No accumulated drift, no irrelevant history, no bloat. The agent loads only what it needs from artifacts.

**Inspectable.** Artifacts are human-readable files. Developers can see exactly what context was transferred. Debugging doesn't require reconstructing message history.

**Selective reading.** Agents don't load all artifacts—only the relevant ones. A knowledge-focused task reads knowledge artifacts; an action task reads action artifacts. This keeps window context lean.

**Survives restarts.** Artifacts persist on disk. Process crashes, timeouts, or deliberate restarts don't lose context. The next agent picks up where the previous left off.

**Enables parallelism.** Multiple agents can write to different artifacts concurrently. No coordination needed—each agent owns its output path.

## Contrast with Direct Handoff

Direct handoff would pass context in memory or message history:

```
Agent A → (context object) → Agent B
```

Problems:

- Context must fit in memory
- Context accumulates across handoffs
- No persistence—crashes lose everything
- No visibility into what was transferred
- Coupling between agent implementations

Artifact handoff:

```
Agent A → (writes artifact) → filesystem → (reads artifact) → Agent B
```

Benefits:

- Unlimited context (filesystem scale)
- Fresh start each time
- Durable persistence
- Full visibility
- No coupling

## What to Include in Artifacts

Good artifacts are self-contained. An agent reading the artifact should understand:

- What task produced this output
- When it was produced (timestamp)
- The actual data/result
- Any relevant metadata

Example artifact structure:

```json
{
  "tool": "rag_query",
  "timestamp": "2026-01-19T12:00:00Z",
  "query": "user authentication flow",
  "results": [...],
  "metadata": {
    "documentCount": 5,
    "avgScore": 0.85
  }
}
```

## Handoff Patterns

**Sequential handoff.** Agent A writes, Agent B reads, Agent B writes, Agent C reads. Linear chain.

**Fan-out.** Planner writes task artifacts, multiple workers read their assigned task, each worker writes completion artifact.

**Fan-in.** Multiple workers write artifacts, planner reads all completion artifacts, synthesizes result.

**Iterative.** Same agent reads its own prior artifact on restart, continues interrupted work.

## Implementation

Artifact writing: `packages/agent/src/artifact/persist.ts`
Artifact reading: Agents use workspace filesystem operations
Artifact paths: Defined by tool `artifactPath` annotation

The CATALOG.md file itself is an artifact—it's the handoff of "what tools exist" from system initialization to agent execution.

## Related Concepts

- **artifact** — The persistence mechanism for handoff
- **context** — What gets transferred
- **direction** — Flow of information in the hierarchy
- **worker** — Agents that receive handoff from planners
