# ALFRED API Surface Documentation

**Owner**: architecture  
**Last Updated**: 2025-01-27

Complete documentation of ALFRED's API surface, transport protocols, and server architecture.

## Overview

ALFRED exposes a comprehensive API surface through multiple transport protocols:

- **tRPC** - Type-safe RPC for all CRUD and query operations (29 routers)
- **SSE (Server-Sent Events)** - Streaming for assistant, orchestrator, and workflow execution
- **WebSocket** - Bidirectional audio streaming for voice interactions
- **HTTP** - Direct endpoints for metrics, health checks, and webhooks

All API endpoints are served through a single Bun runtime with TanStack Start handling SSR and API routes.

## Technology Stack

### Server Runtime

**Bun** - Native JavaScript runtime with built-in HTTP server

- Single entry point: `apps/web/src/server.ts`
- Native WebSocket support via `Bun.serve`
- Automatic `.env` loading
- Direct TypeScript execution (no compilation step)

**TanStack Start** - SSR framework that handles both SSR and API routes

- File-based routing for API endpoints (`apps/web/src/routes/api/`)
- Server functions for server-only logic
- Isomorphic route loaders (run on both server and client)
- Automatic request/response handling

### API Layer

**tRPC** - Type-safe RPC framework (`packages/api/src/trpc.ts`)

- Uses `@trpc/server` with `fetchRequestHandler` adapter
- Procedures: `publicProcedure`, `protectedProcedure`, `authedProcedure`
- Middleware chain: metrics → auth → rate limiting → procedure
- Context creation: Better Auth session + runtime metadata

**Context Structure** (`packages/api/src/context.ts`):

```typescript
type Context = {
  session: AuthSession | null; // Better Auth session
  runtime: RuntimeMetadata; // Request metadata (IP, userAgent, etc.)
  runtimeContext: RuntimeContext; // Workflow execution context
  policy?: { obligations: Obligation[] }; // Policy decision obligations
};
```

### Authentication & Authorization

**Better Auth** - Session management (`packages/auth`)

- Passkey support (WebAuthn)
- Email/password authentication
- Session cookies for web clients
- JWT tokens for native clients

**Policy Enforcement** - Policy Decision Point (PDP) integration (`packages/api/src/gate.ts`)

- Tool scope validation
- Autonomy band checks
- Biometric elevation requirements
- Audit logging for all decisions

**Tool Tokens** - Ed25519-signed tokens (`packages/auth/token`)

- Short-lived tokens (5-minute default TTL)
- Scope-based authorization
- Elevated/MFA claims for dangerous operations

## Transport Protocols

### 1. tRPC (Type-Safe RPC)

**Endpoint**: `/api/trpc/*`  
**Handler**: `apps/web/src/routes/api/trpc/$.ts`  
**Protocol**: HTTP POST/GET with JSON-RPC-like protocol

**Request Flow**:

```
Client Request
  └→ TanStack Start Route Handler
      └→ fetchRequestHandler (tRPC adapter)
          └→ createContext() (session + metadata)
              └→ Procedure Execution
                  ├→ Metrics Middleware (timing, counters)
                  ├→ Auth Middleware (session validation)
                  ├→ Rate Limit Middleware (1000 req/min)
                  └→ Business Logic
```

**Procedure Types**:

- `publicProcedure` - No authentication required (e.g., `healthCheck`)
- `protectedProcedure` - Requires valid session
- `authedProcedure` - Alias for `protectedProcedure`

**Rate Limiting**:

- Global rate limiter: 1000 requests per minute (configurable via `ROUTE_RATE_LIMIT_PER_MINUTE`)
- Single-user context: No per-user rate limiting needed
- Metrics: `rateLimitHitsTotal` counter tracks rate limit violations

**Metrics**:

- `trpcRequestsTotal` - Counter by procedure and type
- `trpcRequestDurationSeconds` - Histogram of request durations
- `trpcRequestErrorsTotal` - Counter by procedure, type, and error code

### 2. SSE (Server-Sent Events)

**Endpoints**:

- `/api/assistant/*` - Assistant streaming (`apps/web/src/routes/api/assistant/$.ts`)
- `/api/orchestrator/*` - Orchestrator streaming (`apps/web/src/routes/api/orchestrator/$.ts`)
- `/api/workflow/stream` - Workflow SSE streaming (`apps/web/src/routes/api/workflow/stream.ts`)

**Protocol**: HTTP POST with `text/event-stream` response  
**Content-Type**: `text/event-stream`  
**Headers**: `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`

**Implementation** (`apps/web/src/lib/api/stream-handler.ts`):

- Uses AI SDK v6 `streamText()` + `toUIMessageStreamResponse()`
- Handles conversation persistence
- Preference prompt injection
- History context building
- Abort signal propagation

**Assistant/Orchestrator Flow**:

```
POST /api/assistant or /api/orchestrator
  └→ handleStreamRequest()
      ├→ Parse messages (UIMessage[])
      ├→ Create conversation (if needed)
      ├→ Persist messages
      ├→ Build preference system prompt
      ├→ Build history context
      └→ streamText() → toUIMessageStreamResponse()
          └→ SSE stream with UIMessage parts
```

**Workflow Stream Flow**:

```
POST /api/workflow/stream
  └→ handleWorkflowStreamRequest()
      ├→ Validate workflow input
      ├→ Authenticate session
      ├→ Enforce workflow plan policy
      ├→ Create workflow suspension handle
      └→ orchestrateWorkflowStream()
          └→ SSE stream with workflow events
              ├→ workflow-event (WorkflowEvent)
              ├→ ui-message (UIMessage[])
              ├→ error (error details)
              └→ complete (completion signal)
```

**Event Types**:

- `workflow-event` - Workflow execution events (scan, plan, act, report)
- `ui-message` - UI messages for chat rendering
- `error` - Error events
- `complete` - Stream completion signal

### 3. WebSocket (Voice Streaming)

**Endpoint**: `ws://<host>:<VOICE_STREAMING_PORT|8788>/voice/stream`  
**Handler**: `packages/api/src/voice/streaming.ts`  
**Status**: Prototype (gated by `VOICE_STREAMING_PROTO=1`)

**Protocol**: Native Bun WebSocket

- Binary frames for audio chunks (PCM, Opus, MP3, etc.)
- JSON frames for control messages
- Authentication via session cookies
- Policy enforcement before upgrade

**Authentication Flow**:

```
WebSocket Upgrade Request
  └→ authorizeVoiceStreamRequest()
      ├→ Rate limit check (IP: 10/min, User: 5/min)
      ├→ Extract session cookie
      ├→ Validate Better Auth session
      ├→ Enforce voice.stt policy
      ├→ Enforce voice.tts policy
      └→ Upgrade to WebSocket (if authorized)
```

**Rate Limiting**:

- **IP-based**: 10 connections per minute per IP (configurable via `VOICE_WS_RATE_LIMIT_PER_IP`)
- **User-based**: 5 connections per minute per user (configurable via `VOICE_WS_RATE_LIMIT_PER_USER`)
- **Rationale**: More restrictive than tRPC (1000 req/min) because:
  - WebSocket connections are long-lived and resource-intensive
  - Voice streaming requires significant CPU/memory per connection
  - Each connection spawns Python subprocesses for STT/TTS
- **Max Concurrent Connections**: 100 global limit
- **Metrics**: `voiceWebSocketUpgradeRateLimitHitsTotal` tracks rate limit violations

**Message Types**:

- `start` - Initialize session with codec preferences
- `audio_chunk` - Binary audio data (PCM/Opus/MP3)
- `vad_state` - Voice activity detection state
- `auto_stop` - Server-initiated stop (VAD-driven)
- `assistant_message` - Assistant text response
- `tts_chunk` - Binary TTS audio output
- `tts_complete` - TTS generation complete
- `status` - Session status updates
- `error` - Error events

**Session Management**:

- Managed by `VoiceRegistry` (`packages/voice/src/server/registry.ts`)
- Session lifecycle: `idle` → `recording` → `processing` → `playing` → `idle`
- 5-minute idle timeout
- Max concurrent connections: 10 (configurable)

**Codec Support**:

- **Input**: PCM, M4A, WebM, MP3, Opus, WAV (normalized via ffmpeg)
- **Output**: PCM (default), MP3, Opus, WAV (re-encoded via ffmpeg)

### 4. HTTP Endpoints

**Metrics** (`/api/metrics`)

- **Handler**: `apps/web/src/routes/api/metrics.ts`
- **Method**: GET
- **Response**: Prometheus format (`text/plain`)
- **Content-Type**: `text/plain; version=0.0.4; charset=utf-8`
- **Metrics Registry**: `packages/api/src/metrics.ts`
  - tRPC metrics (requests, errors, duration)
  - Workflow metrics (runs, phases, context building)
  - Voice metrics (sessions, latency, codec stats)
  - Policy metrics (decisions, obligations)
  - Health check metrics

**Health Checks** (`/healthz`, `/healthz/deps`)

- **Handler**: TanStack Start route handlers
- **Method**: GET
- **Response**: JSON with status and dependency health
- **Metrics**: `health_checks_total` counter

**Better Auth Routes** (`/api/auth/*`)

- **Handler**: `apps/web/src/routes/api/auth/$.ts`
- **Framework**: Better Auth automatic route generation
- **Endpoints**: `/sign-up`, `/sign-in`, `/sign-out`, `/get-session`, etc.

**Linear Webhook** (`/api/linear/webhook`)

- **Handler**: `apps/web/src/routes/api/linear/webhook.ts`
- **Method**: POST
- **Purpose**: Receive Linear webhook events for issue updates

## tRPC Routers (29 total)

### Productivity (5 routers)

**`note`** (`packages/api/src/routers/note.ts`)

- `create` - Create note with content and metadata
- `update` - Update note content/metadata
- `delete` - Soft delete note
- `get` - Get note by ID
- `list` - List notes with pagination and filters
- `search` - Semantic search with embeddings
- `embed` - Generate embeddings for note content

**`remind`** (`packages/api/src/routers/remind.ts`)

- `create` - Create reminder with schedule
- `update` - Update reminder schedule/content
- `delete` - Delete reminder
- `list` - List reminders with filters
- `complete` - Mark reminder as completed

**`timer`** (`packages/api/src/routers/timer.ts`)

- `create` - Create timer
- `start` - Start timer
- `stop` - Stop timer
- `reset` - Reset timer
- `list` - List active timers

**`book`** (`packages/api/src/routers/book.ts`)

- `create` - Create bookmark
- `update` - Update bookmark metadata
- `delete` - Delete bookmark
- `list` - List bookmarks with filters
- `search` - Search bookmarks

**`todo`** (`packages/api/src/routers/todo.ts`)

- `create` - Create todo item
- `update` - Update todo status/content
- `delete` - Delete todo
- `list` - List todos with filters
- `complete` - Mark todo as completed

### AI & Agents (4 routers)

**`assistant`** (`packages/api/src/routers/assistant.ts`)

- `stream` - SSE streaming endpoint (via `/api/assistant`)
- `history` - Get conversation history
- `preferences` - Get assistant preferences

**`orchestrator`** (`packages/api/src/routers/orchestrator.ts`)

- `stream` - SSE streaming endpoint (via `/api/orchestrator`)
- `tools` - List available orchestrator tools
- `capabilities` - Get orchestrator capabilities

**`workflow`** (`packages/api/src/routers/workflow.ts`)

- `create` - Create workflow run
- `get` - Get workflow run by ID
- `list` - List workflow runs with filters
- `cancel` - Cancel running workflow
- `resume` - Resume suspended workflow
- `replay` - Replay workflow events
- `stream` - SSE streaming endpoint (via `/api/workflow/stream`)

**`codex`** (`packages/api/src/routers/codex.ts`)

- `create` - Create codex session
- `execute` - Execute code in session
- `list` - List codex sessions
- `get` - Get session by ID
- `delete` - Delete session

### Voice (1 router)

**`voice`** (`packages/api/src/routers/voice.ts`)

- `speechToSpeech` - Full S2S pipeline (upload → STT → assistant → TTS → download)
- `sessions` - List active voice sessions
- `stream` - tRPC subscription for voice events (legacy, use WebSocket for streaming)

### Knowledge (3 routers)

**`graph`** (`packages/api/src/routers/graph.ts`)

- `query` - Query knowledge graph
- `traverse` - Graph traversal (BFS, DSA-BFS)
- `visualize` - Get subgraph for visualization
- `nodes` - Get nodes by IDs
- `edges` - Get edges by IDs

**`knowledge`** (`packages/api/src/routers/knowledge.ts`)

- `extract` - Extract entities/facts from text
- `search` - Semantic search knowledge
- `retrieve` - Retrieve knowledge by ID
- `update` - Update knowledge confidence/properties

**`cognitive`** (`packages/api/src/routers/cognitive.ts`)

- `state` - Get current cognitive state
- `history` - Get cognitive state history
- `autonomy` - Get autonomy gradient level
- `update` - Update cognitive state (admin only)

### User Settings (4 routers)

**`profile`** (`packages/api/src/routers/profile.ts`)

- `get` - Get user profile
- `update` - Update profile fields
- `avatar` - Upload/update avatar

**`preference`** (`packages/api/src/routers/preference.ts`)

- `get` - Get user preferences
- `update` - Update preferences
- `infer` - Trigger preference inference
- `history` - Get preference history

**`privacy`** (`packages/api/src/routers/privacy.ts`)

- `export` - Export all user data
- `purge` - Delete all user data
- `audit` - Get privacy audit log

**`user`** (`packages/api/src/routers/user.ts`)

- `get` - Get user details
- `update` - Update user settings
- `delete` - Delete user account

### Authentication (3 routers)

**`token`** (`packages/api/src/routers/token.ts`)

- `exchange` - Exchange session for tool token
- `verify` - Verify tool token
- `refresh` - Refresh tool token

**`jwks`** (`packages/api/src/routers/jwks.ts`)

- `get` - Get JSON Web Key Set (public keys for token verification)

**`admin`** (`packages/api/src/routers/admin.ts`)

- `users` - List all users (admin only)
- `metrics` - Get admin metrics
- `audit` - Get audit logs

### Integrations (2 routers)

**`linear`** (`packages/api/src/routers/linear.ts`)

- `connect` - Connect Linear account (OAuth)
- `disconnect` - Disconnect Linear account
- `sync` - Sync Linear issues
- `issues` - List Linear issues
- `update` - Update Linear issue

**`deploy`** (`packages/api/src/routers/deploy.ts`)

- `create` - Create deployment
- `list` - List deployments
- `get` - Get deployment by ID
- `status` - Get deployment status

### Utilities (7 routers)

**`eval`** (`packages/api/src/routers/eval.ts`)

- `definitions` - Manage eval definitions
- `datasets` - Manage eval datasets
- `runs` - Create/list eval runs
- `scores` - Get eval scores

**`terminal`** (`packages/api/src/routers/terminal.ts`)

- `execute` - Execute terminal command
- `sessions` - List terminal sessions

**`fs`** (`packages/api/src/routers/fs.ts`)

- `read` - Read file
- `write` - Write file
- `list` - List directory
- `delete` - Delete file/directory

**`droid`** (`packages/api/src/routers/droids.ts`)

- `execute` - Execute shell command
- `spawn` - Spawn subprocess

**`tune`** (`packages/api/src/routers/tune.ts`)

- `create` - Create fine-tuning job
- `list` - List fine-tuning jobs
- `get` - Get job status

**`visual`** (`packages/api/src/routers/visual.ts`)

- `config` - Get visual configuration
- `update` - Update visual settings

**`codexIntent`** (`packages/api/src/routers/codex-intent.ts`)

- `detect` - Detect codex intent from text
- `classify` - Classify codex request type

## Server Architecture

### Initialization Flow

```
Server Start (apps/web/src/server.ts)
  └→ initServer() (apps/web/src/server/bootstrap.ts)
      ├→ startReminderScheduler() (if SCHED_REMIND=1)
      ├→ startPreferenceInferenceScheduler() (if SCHED_PREFERENCE_INFERENCE=1)
      ├→ startPreferenceDecayScheduler() (if SCHED_PREFERENCE_INFERENCE=1)
      └→ initApiServices() (packages/api/src/init.ts)
          ├→ startCompressionWorker() (if enabled)
          ├→ initializeVoicePools() (if VOICE_PROVIDER=maya1|supertonic)
          └→ startVoiceStreamingPrototype() (if VOICE_STREAMING_PROTO=1)
```

### Request Flow

```
HTTP Request
  └→ TanStack Start Router
      ├→ SSR Route → Server Component
      ├→ API Route → Route Handler
      │   ├→ /api/trpc → tRPC Handler
      │   ├→ /api/assistant → SSE Stream Handler
      │   ├→ /api/orchestrator → SSE Stream Handler
      │   ├→ /api/workflow/stream → Workflow SSE Handler
      │   ├→ /api/metrics → Metrics Handler
      │   ├→ /api/auth/* → Better Auth Handler
      │   └→ /api/linear/webhook → Linear Webhook Handler
      └→ Server Function → Server Function Handler
```

### Background Services

**Reminder Scheduler** (`packages/api/src/scheduler/remind.ts`)

- Gated by `SCHED_REMIND=1`
- Polls database for due reminders
- Sends notifications (future: push notifications)

**Preference Inference Scheduler** (`packages/api/src/scheduler/preference-inference.ts`)

- Gated by `SCHED_PREFERENCE_INFERENCE=1`
- Analyzes user behavior patterns
- Updates preference scores

**Preference Decay Scheduler** (`packages/api/src/scheduler/preference-decay.ts`)

- Gated by `SCHED_PREFERENCE_INFERENCE=1`
- Applies time-based decay to preferences
- Maintains preference freshness

**Compression Worker** (`packages/api/src/compression/worker.ts`)

- Background compression for large payloads
- Uses Web Workers for non-blocking compression

**Voice Pools** (`packages/voice/src/process/`)

- **STT Pool**: Faster-Whisper subprocess pool for speech-to-text
- **TTS Pool**: Maya1/Piper subprocess pool for text-to-speech
- Managed by `VoiceRegistry` for session lifecycle

### Graceful Shutdown

```
SIGTERM/SIGINT
  └→ shutdown() (apps/web/src/server/bootstrap.ts)
      ├→ stopReminderScheduler()
      ├→ stopPreferenceInferenceScheduler()
      ├→ stopPreferenceDecayScheduler()
      └→ shutdownApiServices()
          ├→ stopCompressionWorker()
          └→ shutdownVoicePools()
```

## Security Considerations

### Authentication

- **Session-based**: Better Auth sessions for web clients
- **Token-based**: Ed25519 tool tokens for agent operations
- **Test Mode**: `x-alfred-test-session` header (non-production only)

### Authorization

- **Policy Enforcement**: All sensitive operations go through PDP
- **Scope Validation**: Tool tokens validated for required scopes
- **Autonomy Bands**: Operations gated by autonomy level
- **Biometric Elevation**: Dangerous operations require fresh biometric ticket

### Rate Limiting

- **Global**: 1000 requests per minute (configurable)
- **Single-user**: No per-user rate limiting (personal assistant context)
- **Metrics**: Rate limit hits tracked via `rateLimitHitsTotal`

### Input Validation

- **Zod Schemas**: All inputs validated via Zod schemas
- **Type Safety**: tRPC provides end-to-end type safety
- **Sanitization**: User inputs sanitized before database writes

### Error Handling

- **Structured Errors**: All errors include context and error codes
- **No Stack Traces**: Stack traces never exposed to clients
- **Graceful Degradation**: Missing dependencies handled gracefully (DB, UV)

## Performance Characteristics

### tRPC Procedures

- **Target**: <10ms p99 for simple queries
- **Metrics**: `trpcRequestDurationSeconds` histogram
- **Optimization**: Database indexes, batch operations, connection pooling

### Streaming Endpoints

- **SSE**: Low latency (<100ms first chunk)
- **WebSocket**: Real-time bidirectional (<50ms round-trip)
- **Abort Handling**: Proper cleanup on client disconnect

### Database Queries

- **Target**: <10ms p99 for all repo queries
- **Indexes**: Composite indexes match query predicates
- **Batch Operations**: Use `db.batch()` for multiple queries
- **Transactions**: Keep transactions short (<100ms)

## Development Guidelines

### Variable-Based Dynamic Imports

Server routes MUST use variable-based dynamic imports to prevent server code leakage:

```typescript
// ✅ Correct
const pkg = "@alfred/api";
const { appRouter } = await import(pkg);

// ❌ Incorrect (leaks server code to client bundle)
import { appRouter } from "@alfred/api";
```

### Graceful Degradation

- Check `isDbAvailable()` before DB operations
- Check `isUvAvailable()` before UV operations
- Return sensible defaults instead of crashing

### Error Handling

- Use `toTRPCError()` for unknown errors
- Include context in error messages
- Never expose stack traces to clients

### Metrics

- Register metrics in `packages/api/src/metrics.ts`
- Use Prometheus client (`prom-client`)
- Include labels for filtering/aggregation

## Related Documentation

- [Feature Inventory](./feature-inventory.md) - Complete feature list
- [Server Entry Point](./server-entry-point-implementation.md) - Server initialization details
- [Voice Architecture](../guides/voice-architecture.md) - Voice system details
- [Workflow Patterns](../guides/workflow-patterns.md) - Workflow execution patterns
- [Linear Integration](../guides/linear-integration.md) - Linear integration details
