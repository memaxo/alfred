****# Codex CLI & Droid Agents Analysis Report

## 1. Executive Summary

The Alfred codebase implements a sophisticated agentic architecture leveraging **Codex** (via OpenAI SDK/CLI) and **Droid** (a custom sandboxed CLI) as the primary execution engines. These agents are orchestrated by a central runtime that manages dependency graphs ("Waves"), enforces security policies, and provides robust isolation via **Git Worktrees** and **Docker containers**.

The system is designed for high scalability and reliability, featuring:
- **Worktree Isolation**: Parallel agent execution without file contention.
- **Context Injection**: Dynamic injection of Linear issues and "Learning" from past execution success/failure.
- **Event-Driven Architecture**: Structured event emission (thoughts, commands, artifacts) for observability.

---

## 2. Agent Execution Engines

### 2.1 Codex Agent (`packages/agent/**/tool/codex`)
The Codex agent serves as the primary "thinking" engine, wrapping the `@openai/codex-sdk`.

*   **Execution Modes**:
    *   **SDK Mode**: Direct usage of the Node.js SDK.
    *   **CLI Mode**: Spawns a local `codex` binary.
    *   **Docker Mode**: Executes `codex` inside a container (`docker exec`) for high-risk tasks.
*   **Autonomy Levels**: Supports `read`, `low`, `medium`, and `high` autonomy. Higher levels require biometric elevation (Passkey) enforced by `packages/auth`.
*   **Sandboxing**: Maps autonomy levels to Codex sandbox policies (`read-only` vs `workspace-write`) and approval modes.

### 2.2 Droid Agent (`packages/agent/**/tool/droid`)
The Droid agent is a specialized, non-interactive CLI tool designed for deterministic task execution.

*   **Binary**: Executes a configurable `droid` binary (env: `DROID_BIN`).
*   **Output Parsing**: Streams `stdout`/`stderr` and parses line-delimited JSON for structured events (`thought`, `command`, `artifact`).
*   **Security**: Enforces strictly defined `allow` prefixes for CWD to prevent filesystem traversals.

---

## 3. Testing & Sandboxing Environments

### 3.1 Git Worktree Isolation
To solve the scalability challenge of multi-agent file contention, the system uses **Git Worktrees**.

*   **Mechanism**: `packages/agent/src/environment/worktree.ts`
*   **Flow**:
    1.  **Create**: `git worktree add -b agent/<runId>/<agentId> .agent/worktrees/<runId>/<agentId>`
    2.  **Execute**: Agent runs exclusively within this isolated directory.
    3.  **Cleanup**: Worktrees are pruned after execution.
*   **Benefit**: Allows $N$ agents to edit the "same" repo simultaneously without lock contention or dirty working trees.

### 3.2 Context Management (Checkpoints)
The system implements a "Time Machine" feature for agents using Git tags.

*   **Checkpoint**: `git tag -f checkpoint/<runId>/<id>/<label>`
*   **Restore**: `git reset --hard <tag>` + `git clean -fd`
*   **Usage**: Enables agents to speculatively try changes and roll back safely upon failure or test regression.

---

## 4. Orchestration & Scalability

### 4.1 Wave-Based Execution
The Orchestrator (`packages/agent/src/orchestrator/multi/waves.ts`) manages concurrency using a dependency graph.

*   **Algorithm**:
    1.  Builds a dependency graph of `SubTask`s.
    2.  Calculates In-Degree for topological sorting.
    3.  Groups independent tasks into "Waves".
    4.  Executes tasks in a Wave in parallel (up to `maxParallel` limit).
*   **Scalability**: This architecture allows the system to scale horizontally across CPU cores (or networked nodes if extended) by simply increasing the `maxParallel` factor, as worktrees provide the necessary filesystem isolation.

### 4.2 Session Management
`CodexSessionManager` (`codex-session.ts`) maintains state consistency.
*   **LRU Cache**: Caches session metadata (thread IDs, status) to minimize API overhead.
*   **Continuity**: Tracks session success/failure to inform backoff strategies.

---

## 5. Learning & Context Integration

### 5.1 "Learning" Subsystem
The system implements a Retrieval-Augmented Generation (RAG) loop for *process knowledge* (`packages/db/src/repo/codex-learning.ts`).

*   **Capture**: Every execution result (success/failure) and its reasoning is persisted in the graph database.
*   **Retrieval**: Before a new task starts, the system queries for "Similar Past Executions" based on semantic similarity of the prompt.
*   **Injection**: Summaries of these past executions (including code snippets and error modes) are injected into the Codex prompt context.
*   **Impact**: Agents "learn" from previous mistakes without model fine-tuning.

### 5.2 Linear Integration
Direct integration with the Linear issue tracker (`codex-linear.ts`).
*   **Context**: Injects Issue Title, Description, and Comments directly into the agent's system prompt.
*   **Feedback**: Agent events (`thought`, `command`) can be mapped back to Linear comments or status updates (Activity).

---

## 6. Documentation Analysis (`docs/reference`)

The codebase contains extensive documentation references in `docs/reference/`:

*   **Factory (`docs/reference/factory/droid.md`)**:
    *   Detailed specs for the Droid agent protocol.
    *   Context research notes (`context-research.txt`) suggesting deep investigation into context window optimization.
*   **Codex CLI (`docs/reference/codex-cli/`)**:
    *   **`config.md`**: Comprehensive configuration guide (timeouts, output caps).
    *   **`sandbox.md`**: details the security model and isolation guarantees.
    *   **`profiles.md`**: Explains how to switch between different agent personas/capabilities.

## 7. Conclusion

The Alfred agent architecture is **highly mature and scalable**. It moves beyond simple "loop" scripts by implementing:
1.  **Physical Isolation**: Git Worktrees are a game-changer for parallel local agents.
2.  **Cognitive Continuity**: The "Learning" repo turns the database into a long-term memory of *how to code*.
3.  **Enterprise Safety**: Strict separation of autonomy levels and biometric enforcement.

**Recommendations**:
*   **Containerization**: While Docker support exists in code (`exec.ts`), it should be made the default for `auto=high` tasks to prevent host system modification.
*   **Network Policy**: Explicit network allow/deny lists for the Droid binary would enhance the sandbox.
