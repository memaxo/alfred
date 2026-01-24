# ALFRED Feature Inventory

Owner: architecture

A comprehensive inventory of all implemented ALFRED features, modules, and capabilities discovered from codebase analysis. Last updated: 2025-12.

## Overview

ALFRED is organized as a monorepo with:

- **2 applications**: `apps/web` (TanStack Start), `apps/native` (React Native/Expo)
- **19 packages**: Core functionality split across domain-driven packages
- **29 tRPC routers**: API layer for all operations
- **14 database schemas**: Drizzle ORM definitions
- **44 migrations**: PostgreSQL schema evolution

## Core Packages

### @alfred/agent

**Location**: `packages/agent/`  
**Purpose**: AI agent implementations for assistant and orchestrator roles

Components:

- `assistant/src/tool/` - Personal assistant tools (note, remind, timer, book, focus, memory)
- `src/orchestrator/tool/` - Orchestrator tools (docker, git, proxmox, ticket, web, droid, codex)
- `src/v6.ts` - AI SDK v6 tool registry
- `src/preference/` - Preference inference and learning
- `src/multi/` - Multi-agent coordination (spawn, merge, conflict resolution)

### @alfred/api

**Location**: `packages/api/`  
**Purpose**: tRPC routers, context, and API infrastructure

Components:

- `src/routers/` - 29 tRPC routers (see API Routers section)
- `src/metrics.ts` - Prometheus metrics registry
- `src/voice/` - Voice API handlers (S2S, streaming)
- `src/workflow/` - Workflow suspension/resume logic
- `src/scheduler/` - Background job scheduling

### @alfred/auth

**Location**: `packages/auth/`  
**Purpose**: Authentication and security primitives

Components:

- `biometric.ts` - Biometric ticket management
- `token.ts` - Ed25519 tool token issuance/verification
- `jwks.ts` - JSON Web Key Set generation
- Better Auth integration with passkey support

### @alfred/cognitive

**Location**: `packages/cognitive/`  
**Purpose**: Cognitive state machine and autonomy management

Components:

- `state.ts` - Cognitive state definitions
- `transition.ts` - State transition logic
- `logic/autonomy.ts` - Bayesian autonomy gradient
- `flows.ts` - Capture/Synthesis/Execution/Reflection flows
- `metrics.ts` - Cognitive performance metrics

### @alfred/cortex

**Location**: `packages/cortex/`  
**Purpose**: WebGPU visualization engine for Mindscape

Components:

- `engine.ts` - Core WebGPU render engine
- `systems/` - Rendering systems (nodes, edges, particles, atmosphere, corona, postprocess)
- `shaders/` - WGSL shader programs
- `fallback/` - Canvas2D and WebGL fallbacks
- `lod.ts` - Level-of-detail management

### @alfred/db

**Location**: `packages/db/`  
**Purpose**: Database schema, migrations, and repositories

Components:

- `src/schema/` - 14 Drizzle schema files
- `src/migrations/` - 44 SQL migrations
- `src/repos/` - Repository implementations
- pgvector support for embeddings

### @alfred/embed

**Location**: `packages/embed/`  
**Purpose**: Local embedding generation

Components:

- KaLM-Embedding-Gemma3-12B-2511 model (1024 dims via MRL)
- Python subprocess pool with IPC
- ROCm (Linux) and MPS (macOS) support
- Zero API costs, full privacy

### @alfred/knowledge

**Location**: `packages/knowledge/`  
**Purpose**: Knowledge graph and extraction

Components:

- `hypergraph.ts` - Hypergraph memory structure
- `extract/` - Entity, fact, relation, pattern extraction
- `indices/` - BTree, RTree, interval tree, KNN indices
- `reasoning/` - Causality, decisions, alternatives
- `query.hot.ts` - Performance-critical queries

### @alfred/policy

**Location**: `packages/policy/`  
**Purpose**: Policy Decision Point (PDP)

Components:

- Policy evaluation engine
- YAML policy definitions
- Tool scope enforcement
- Autonomy band validation

### @alfred/rag

**Location**: `packages/rag/`  
**Purpose**: Retrieval-Augmented Generation

Components:

- Document ingestion and chunking
- Semantic search with pgvector HNSW
- Hybrid search (vector + full-text)

### @alfred/runtime

**Location**: `packages/runtime/`  
**Purpose**: Workflow execution engine

Components:

- `WorkflowRuntime` class with AsyncGenerator interface
- Phase orchestration (scan, plan, act, report)
- Engine wrappers (CognitiveEngine, KnowledgeEngine, LearningEngine)
- Context builder with caching

### @alfred/voice

**Location**: `packages/voice/`  
**Purpose**: Speech-to-speech infrastructure

Components:

- `process/stt.ts` - STT pool (Faster-Whisper)
- `process/tts.ts` - TTS pool (Maya1)
- `server/` - WebSocket session management
- `audio/` - Codec handling (Opus, PCM)

### @alfred/ui

**Location**: `packages/ui/`  
**Purpose**: Shared UI components

Components:

- `chat/chat.tsx` - Chat component
- `pane/` - Management panes (note, remind, timer, book, home)

### Supporting Packages

- `@alfred/graph` - Graph utilities
- `@alfred/history` - Conversation history
- `@alfred/learning` - Self-supervision
- `@alfred/logger` - Structured logging
- `@alfred/metrics` - Performance metrics
- `@alfred/type` - Shared TypeScript types
- `@alfred/test-kit` - Testing utilities

## API Routers (29 total)

### Productivity (5)

| Router   | Path                                 | Purpose                        |
| -------- | ------------------------------------ | ------------------------------ |
| `note`   | `packages/api/src/routers/note.ts`   | Notes CRUD, search, embeddings |
| `remind` | `packages/api/src/routers/remind.ts` | Reminders with scheduling      |
| `timer`  | `packages/api/src/routers/timer.ts`  | Timer controls                 |
| `book`   | `packages/api/src/routers/book.ts`   | Bookmarks management           |
| `todo`   | `packages/api/src/routers/todo.ts`   | Todo items                     |

### AI & Agents (4)

| Router         | Path                                       | Purpose                         |
| -------------- | ------------------------------------------ | ------------------------------- |
| `assistant`    | `packages/api/src/routers/assistant.ts`    | Personal assistant interactions |
| `orchestrator` | `packages/api/src/routers/orchestrator.ts` | Complex workflow orchestration  |
| `workflow`     | `packages/api/src/routers/workflow.ts`     | Workflow run management         |
| `codex`        | `packages/api/src/routers/codex.ts`        | Code execution sessions         |

### Voice (1)

| Router  | Path                                | Purpose                      |
| ------- | ----------------------------------- | ---------------------------- |
| `voice` | `packages/api/src/routers/voice.ts` | STT/TTS, streaming, sessions |

### Knowledge (3)

| Router      | Path                                    | Purpose                    |
| ----------- | --------------------------------------- | -------------------------- |
| `graph`     | `packages/api/src/routers/graph.ts`     | Knowledge graph queries    |
| `knowledge` | `packages/api/src/routers/knowledge.ts` | Knowledge retrieval        |
| `cognitive` | `packages/api/src/routers/cognitive.ts` | Cognitive state management |

### User Settings (4)

| Router       | Path                                     | Purpose                |
| ------------ | ---------------------------------------- | ---------------------- |
| `profile`    | `packages/api/src/routers/profile.ts`    | User profile           |
| `preference` | `packages/api/src/routers/preference.ts` | Preferences, inference |
| `privacy`    | `packages/api/src/routers/privacy.ts`    | Data purge/export      |
| `user`       | `packages/api/src/routers/user.ts`       | User operations        |

### Authentication (3)

| Router  | Path                                | Purpose             |
| ------- | ----------------------------------- | ------------------- |
| `token` | `packages/api/src/routers/token.ts` | Tool token exchange |
| `jwks`  | `packages/api/src/routers/jwks.ts`  | JWKS endpoint       |
| `admin` | `packages/api/src/routers/admin.ts` | Admin operations    |

### Integrations (2)

| Router   | Path                                 | Purpose               |
| -------- | ------------------------------------ | --------------------- |
| `linear` | `packages/api/src/routers/linear.ts` | Linear OAuth, sync    |
| `deploy` | `packages/api/src/routers/deploy.ts` | Deployment management |

### Utilities (7)

| Router        | Path                                       | Purpose                |
| ------------- | ------------------------------------------ | ---------------------- |
| `eval`        | `packages/api/src/routers/eval.ts`         | Evaluation harness     |
| `terminal`    | `packages/api/src/routers/terminal.ts`     | Terminal operations    |
| `fs`          | `packages/api/src/routers/fs.ts`           | Filesystem operations  |
| `droid`       | `packages/api/src/routers/droids.ts`       | Shell execution        |
| `tune`        | `packages/api/src/routers/tune.ts`         | Model fine-tuning      |
| `visual`      | `packages/api/src/routers/visual.ts`       | Visual configuration   |
| `codexIntent` | `packages/api/src/routers/codex-intent.ts` | Codex intent detection |

## Orchestrator Tools

### Container & Infrastructure

| Tool      | Location          | Purpose                     |
| --------- | ----------------- | --------------------------- |
| `docker`  | `tool/docker.ts`  | Docker container management |
| `proxmox` | `tool/proxmox.ts` | Proxmox LXC/VM management   |

### Development

| Tool       | Location           | Purpose                        |
| ---------- | ------------------ | ------------------------------ |
| `git`      | `tool/git.ts`      | Git version control operations |
| `droid`    | `tool/droid.ts`    | Shell command execution        |
| `codex`    | `tool/codex/`      | Code execution with sessions   |
| `worktree` | `tool/worktree.ts` | Git worktree management        |

### Integrations

| Tool     | Location         | Purpose                 |
| -------- | ---------------- | ----------------------- |
| `ticket` | `tool/ticket.ts` | Linear issue management |
| `web`    | `tool/web.ts`    | Web research            |

### Knowledge

| Tool        | Location          | Purpose                    |
| ----------- | ----------------- | -------------------------- |
| `knowledge` | `tool/knowledge/` | Knowledge graph operations |
| `rag`       | `tool/rag/`       | RAG document management    |
| `learning`  | `tool/learning/`  | Learning system operations |
| `reflect`   | `tool/reflect.ts` | Self-reflection            |

## Assistant Tools

Located in `packages/agent/assistant/src/tool/`:

| Tool         | Purpose                   |
| ------------ | ------------------------- |
| `note`       | Note creation/search      |
| `remind`     | Reminder management       |
| `timer`      | Timer controls            |
| `book`       | Bookmark management       |
| `focus`      | Focus/drive mode          |
| `handoff`    | Orchestrator escalation   |
| `home`       | Home Assistant (skeleton) |
| `preference` | Preference updates        |
| `web`        | Web research              |
| `memory/`    | 8 explicit memory tools   |

### Memory Tools (8)

| Tool              | Purpose                         |
| ----------------- | ------------------------------- |
| `memory_search`   | Semantic search with embeddings |
| `memory_retrieve` | Get memory by ID with neighbors |
| `memory_update`   | Update confidence/properties    |
| `memory_remove`   | Soft/hard delete                |
| `memory_boost`    | Reinforce memories              |
| `memory_traverse` | Graph traversal (BFS/DSA-BFS)   |
| `memory_history`  | Conversation history            |
| `memory_stats`    | System health metrics           |

## Database Schema (14 files)

| Schema            | Tables                                                  |
| ----------------- | ------------------------------------------------------- |
| `auth.ts`         | user, session, account, verification, passkey           |
| `assistant.ts`    | notes, reminders, timers, bookmarks, user_facts         |
| `workflow.ts`     | workflow_runs, workflow_events                          |
| `graph.ts`        | memory_nodes, memory_edges                              |
| `rag.ts`          | rag_documents, rag_chunks                               |
| `eval.ts`         | eval_definitions, eval_datasets, eval_runs, eval_scores |
| `cognitive.ts`    | cognitive_states                                        |
| `conversation.ts` | threads, messages                                       |
| `deploy.ts`       | deployments                                             |
| `linear.ts`       | linear_issues, linear_sessions                          |
| `policy.ts`       | policy_audit_logs                                       |
| `codex.ts`        | codex_sessions                                          |
| `todo.ts`         | todos                                                   |
| `user.ts`         | user_events                                             |

## Migrations (44 total)

Key migrations by area:

- `0000-0001`: Core extensions and initial schema
- `0002-0007`: Linear, assistant, deployments, personalization, policy
- `0010-0013`: Vector indexes, passkeys, evals
- `0017-0024`: Memory optimization, RAG, conversations, embeddings
- `0027-0037`: Embedding dimension updates, graph indexes
- `0038-0052`: Cognitive state, indexes, codex sessions, knowledge corrections

## Web Application

**Location**: `apps/web/`

### Routes

| Route                         | Purpose                               |
| ----------------------------- | ------------------------------------- |
| `/`                           | Home/dashboard                        |
| `/login`                      | Authentication                        |
| `/onboarding`                 | User onboarding                       |
| `/_protected/mindscape`       | Mindscape visualization               |
| `/_protected/drive`           | Drive mode                            |
| (Desktop) Settings window     | Unified settings “desktop app” window |
| `/_protected/voice-s2s`       | Voice interface                       |
| `/_protected/workflow.$runId` | Workflow viewer                       |
| `/api/trpc/`                  | tRPC endpoint                         |
| `/api/auth/`                  | Better Auth                           |
| `/api/workflow/stream`        | Workflow streaming                    |
| `/healthz`                    | Health checks                         |

### Key Components

- `chat-container.tsx` - Main chat interface
- `mindscape/` - Spatial visualization (25+ node types)
- `ai-elements/` - AI response rendering
- `onboarding/` - Onboarding wizard
- `ui/` - 38 shadcn/ui components

## Native Application

**Location**: `apps/native/`

### Screens

| Screen        | Purpose            |
| ------------- | ------------------ |
| `index.tsx`   | Home (placeholder) |
| `drive.tsx`   | Drive mode         |
| `profile.tsx` | User profile       |
| `ai.tsx`      | AI chat            |
| `todos.tsx`   | Todo list          |

### Components

- `voice/` - Voice capture, playback, queue
- `carplay/` - CarPlay integration
- Auth client with Better Auth

## Observability

### Prometheus Metrics (12+)

- Workflow execution counters and histograms
- Phase duration tracking
- Context building metrics
- AI SDK call tracking
- Knowledge persistence metrics

### Infrastructure

- Structured logging (`@alfred/logger`)
- Distributed tracing (nanosecond precision)
- Grafana dashboard configurations
- Health check endpoints

## Key Technical Decisions

1. **Local-First**: Embeddings (KaLM-Embedding-Gemma3-12B), voice models (Faster-Whisper, Maya1) all run locally. Zero API costs, full privacy.

2. **Performance Budgets**: Validated and enforced:
   - Transitions: <100µs
   - Queries: <10ms
   - Cached context: <50ms
   - Uncached context: <5s

3. **Single-User Design**: No multi-tenancy complexity. Aggressive defaults, direct user benefit.

4. **Pure Functions**: Core logic (cognitive, knowledge) is pure. Side effects isolated at boundaries (routers, schedulers).

5. **AI SDK v6**: Native streaming, tool definitions, message conversion all use AI SDK v6 patterns.

## Implementation Status

### Fully Implemented

- Core infrastructure (auth, db, api)
- Runtime engine with phase orchestration
- Voice system (STT/TTS pools, WebSocket)
- Knowledge graph with hypergraph memory
- RAG pipeline with local embeddings
- Cognitive state machine
- Mindscape visualization
- 29 tRPC routers

### Partially Implemented

- Timer/Bookmark UI panes (routers exist, no web routes)
- Mobile chat interface (placeholder)
- Home Assistant integration (skeleton)
- Message editing/regeneration

### Pending

- Tool chaining and dependencies (Phase 5.3)
- Load testing (Phase 8)
- Proxmox deployment (Phase 9.2)
- Mobile notifications

## Related Documentation

- [PRD](../alfred-prd.md) - Development phases and milestones
- [Architecture Overview](./overview.md) - System architecture
- [Cognitive Guide](../guides/cognitive-architecture.md) - Cognitive state machine
- [Voice Architecture](../guides/voice-architecture.md) - Speech-to-speech
- [Linear Integration](../guides/linear-integration.md) - Linear Agent Activities
