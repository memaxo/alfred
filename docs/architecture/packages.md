# ALFRED Package Organization

Detailed guide to the monorepo package structure and dependencies.

## Package Dependency Graph

```
                    ┌─────────┐
                    │  type   │  (no dependencies)
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼───┐      ┌────▼─────┐    ┌────▼────┐
    │  db   │      │ cognitive│    │ policy  │
    └───┬───┘      └────┬─────┘    └────┬────┘
        │               │               │
    ┌───▼────┐     ┌────▼──────┐   ┌───▼─────┐
    │knowledge│     │ learning  │   │  auth   │
    └───┬────┘     └────┬──────┘   └───┬─────┘
        │               │              │
        └───────┬───────┴──────────────┘
                │
         ┌──────▼──────┐
         │   runtime   │  (NEW - Phase 3)
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │    agent    │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │     api     │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │     ui      │
         └──────┬──────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼───┐             ┌─────▼─────┐
│  web  │             │  native   │
└───────┘             └───────────┘
```

## Package Details

### Foundation Layer

#### `packages/type/`

**Purpose**: Shared TypeScript types and interfaces  
**Dependencies**: None  
**Exports**: DTOs, enums, interfaces for cross-package communication

```typescript
// Example exports
export type WorkflowInput = { ... };
export type WorkflowEvent = { ... };
export type CognitiveState = { ... };
```

**Rules**:
- No runtime code, only types
- No dependencies on other packages
- Pure contracts

### Data Layer

#### `packages/db/`

**Purpose**: Database access and schema management  
**Dependencies**: `type`, `drizzle-orm`, `pg`

**Structure**:
```
packages/db/
├── src/
│   ├── client.ts          # Drizzle client
│   ├── schema/            # Table definitions
│   │   ├── user.ts
│   │   ├── assistant.ts   # notes, reminders, timers
│   │   ├── workflow.ts    # runs, events
│   │   ├── deploy.ts      # deployments
│   │   ├── graph.ts       # knowledge hypergraph
│   │   ├── eval.ts        # evaluation results
│   │   └── policy.ts      # audit logs
│   ├── repo/              # Type-safe queries
│   │   ├── note.ts
│   │   ├── workflow.ts
│   │   └── graph.ts
│   └── migrations/        # SQL migrations
│       ├── 0000_extensions.sql
│       ├── 0001_init.sql
│       └── ...
├── scripts/
│   └── migrate.ts         # Migration runner
└── test/                  # DB tests
```

**Key Functions**:
- Schema definitions with Drizzle
- Type-safe repositories
- Idempotent migrations
- Test harness for integration tests

### Domain Layer

#### `packages/cognitive/`

**Purpose**: Cognitive state management  
**Dependencies**: `type`

**Exports**:
```typescript
export type CognitiveState = {
  state: "idle" | "thinking" | "deciding" | "acting" | "learning" | "reflecting";
  attention: Attention;
  load: number;
  prediction: unknown;
};

export function transition(state: CognitiveState, event: Event): CognitiveState;
```

**Responsibilities**:
- Pure state machine (no side effects)
- Cognitive load tracking
- Attention management
- State transition logic

#### `packages/knowledge/`

**Purpose**: Hypergraph memory and queries  
**Dependencies**: `type`, `db`

**Exports**:
```typescript
export class KnowledgeGraph {
  async query(params: QueryParams): Promise<QueryResult>;
  async addNode(node: Node): Promise<void>;
  async addEdge(edge: Edge): Promise<void>;
  async addPattern(pattern: Pattern): Promise<void>;
}
```

**Responsibilities**:
- Fact storage and retrieval
- Relation management
- Pattern recognition
- HAMT/interval/B-tree indices

#### `packages/learning/`

**Purpose**: Self-supervision and improvement  
**Dependencies**: `type`, `db`

**Exports**:
```typescript
export async function record(outcome: LearningOutcome): Promise<void>;
export async function getPatterns(params: PatternQuery): Promise<Pattern[]>;
export async function analyzeError(error: Error): Promise<Analysis>;
```

**Responsibilities**:
- Outcome recording (prediction vs. actual)
- Pattern extraction
- Mistake analysis
- Confidence scoring

#### `packages/rag/`

**Purpose**: Semantic search and retrieval  
**Dependencies**: `type`, `db`

**Exports**:
```typescript
export async function ingest(doc: Document): Promise<void>;
export async function retrieve(query: string, topK: number): Promise<Chunk[]>;
export async function embed(text: string): Promise<number[]>;
```

**Responsibilities**:
- Document chunking
- Embedding generation (OpenAI API)
- pgvector similarity search
- Hybrid search with knowledge graph

#### `packages/policy/`

**Purpose**: Security and access control  
**Dependencies**: `type`

**Exports**:
```typescript
export async function evaluate(request: PolicyRequest): Promise<PolicyDecision>;
export function loadPolicies(yaml: string): Policy[];
```

**Responsibilities**:
- YAML policy loading
- PDP (Policy Decision Point) evaluation
- Obligation enforcement
- Audit logging

### Integration Layer (NEW)

#### `packages/runtime/` 🆕

**Purpose**: Compose all domain packages into cohesive execution  
**Dependencies**: `cognitive`, `knowledge`, `learning`, `policy`, `agent`, `db`

**Structure**:
```
packages/runtime/
├── src/
│   ├── core/
│   │   └── runtime.ts       # CoreRuntime class
│   ├── workflow/
│   │   ├── runtime.ts       # WorkflowRuntime class
│   │   └── normalize.ts     # Event normalization
│   ├── context/
│   │   └── builder.ts       # Context building
│   └── domains/
│       ├── proxmox.ts       # Proxmox-specific runtime
│       ├── development.ts   # Git/Docker runtime
│       └── productivity.ts  # Notes/tasks runtime
└── test/
    ├── core-runtime.test.ts
    └── workflow-runtime.test.ts
```

**Key Classes**:

```typescript
// CoreRuntime: Composes domain packages
export class CoreRuntime {
  async buildContext(input: UserRequest): Promise<ExecutionContext>;
  async recordOutcome(input: UserRequest, result: ExecutionResult): Promise<void>;
}

// WorkflowRuntime: Adds AI SDK streaming
export class WorkflowRuntime extends CoreRuntime {
  async *execute(input: WorkflowInput): AsyncGenerator<WorkflowEvent>;
}

// ProxmoxRuntime: Domain-specific context
export class ProxmoxRuntime extends WorkflowRuntime {
  async buildContext(input: ProxmoxTask): Promise<ProxmoxContext>;
}
```

**This is the conductor that makes all packages work together.**

### Execution Layer

#### `packages/agent/`

**Purpose**: AI SDK tool definitions  
**Dependencies**: `type`, `cognitive`, `knowledge`, `learning`

**Structure** (After Phase 5 restructuring):
```
packages/agent/
├── src/
│   ├── tools/
│   │   ├── assistant/       # Personal assistant tools
│   │   │   ├── note.ts
│   │   │   ├── remind.ts
│   │   │   ├── timer.ts
│   │   │   ├── book.ts
│   │   │   ├── focus.ts
│   │   │   ├── web.ts
│   │   │   ├── handoff.ts
│   │   │   └── home.ts
│   │   └── orchestrator/    # Orchestration tools
│   │       ├── codex.ts
│   │       ├── docker.ts
│   │       ├── droid.ts
│   │       ├── git.ts
│   │       ├── proxmox.ts
│   │       ├── router.ts
│   │       ├── ticket.ts
│   │       └── web.ts
│   ├── registry.ts          # AI SDK v6 tool registry
│   └── helpers/
│       └── linear.ts        # Linear integration helpers
└── test/
```

**Key Exports**:
```typescript
export function buildAssistantTools(): ToolMap;
export function buildOrchestratorTools(): ToolMap;
export function buildTools(): ToolMap; // All tools
```

### API Layer

#### `packages/api/`

**Purpose**: HTTP/tRPC surface  
**Dependencies**: `runtime`, `agent`, `auth`, `policy`, `db`, `type`

**Structure**:
```
packages/api/
├── src/
│   ├── index.ts             # tRPC app router
│   ├── context.ts           # Request context
│   ├── trpc.ts              # tRPC factory
│   ├── gate.ts              # Policy middleware
│   ├── metrics.ts           # Prometheus registry
│   ├── routers/
│   │   ├── assistant.ts     # Assistant chat
│   │   ├── orchestrator.ts  # Orchestrator chat
│   │   ├── workflow.ts      # Workflow execution
│   │   ├── note.ts          # Notes CRUD
│   │   ├── remind.ts        # Reminders
│   │   ├── timer.ts         # Timers
│   │   ├── book.ts          # Bookmarks
│   │   ├── deploy.ts        # Deployments
│   │   ├── linear.ts        # Linear OAuth
│   │   ├── voice.ts         # STT/TTS
│   │   ├── profile.ts       # Profile management
│   │   ├── preference.ts    # Preferences
│   │   ├── privacy.ts       # Data export/purge
│   │   ├── jwks.ts          # JWKS endpoint
│   │   └── token.ts         # Token exchange
│   └── utils/
│       ├── error.ts         # Error normalization
│       └── logger.ts        # Structured logging
└── test/
```

**Key Pattern**:
```typescript
// Routers are thin wrappers around runtime
const runtime = new WorkflowRuntime();

export const workflowRouter = router({
  stream: authedProcedure
    .input(workflowInput)
    .subscription(({ input }) =>
      observable((emit) => {
        (async () => {
          for await (const event of runtime.execute(input)) {
            emit.next(event);
          }
        })();
      })
    ),
});
```

#### `packages/auth/`

**Purpose**: Authentication and token management  
**Dependencies**: `type`, `db`, Better Auth

**Exports**:
```typescript
export const auth; // Better Auth instance
export function issueToken(claims: Claims): string;
export function verifyToken(token: string): Claims;
export function generateJWKS(): JWKS;
```

#### `packages/metrics/`

**Purpose**: Observability  
**Dependencies**: `type`, prom-client

**Exports**:
```typescript
export const metricsRegistry;
export const trpcRequestsTotal;
export const workflowStreamEventsTotal;
// ... all metrics
```

### UI Layer

#### `packages/ui/`

**Purpose**: Shared React components  
**Dependencies**: `type`

**Structure**:
```
packages/ui/
├── src/
│   ├── chat/
│   │   └── chat.tsx         # Chat component
│   ├── pane/
│   │   ├── note.tsx
│   │   ├── remind.tsx
│   │   ├── timer.tsx
│   │   └── book.tsx
│   └── primitives/          # Basic UI elements
└── test/
```

### Application Layer

#### `apps/web/`

**Purpose**: Web interface (TanStack Start)  
**Dependencies**: `api`, `ui`, `type`

**Structure**:
```
apps/web/
├── src/
│   ├── routes/
│   │   ├── index.tsx        # Home
│   │   ├── chat.tsx         # Chat interface
│   │   ├── settings/        # Settings pages
│   │   └── api/             # API endpoints
│   │       ├── trpc/
│   │       ├── auth/
│   │       ├── metrics.ts
│   │       └── linear/
│   ├── components/          # App-specific components
│   └── lib/                 # tRPC client setup
└── vite.config.ts
```

#### `apps/native/`

**Purpose**: Mobile app (React Native + Expo)  
**Dependencies**: `api`, `ui`, `type`

**Structure**:
```
apps/native/
├── app/                     # Expo Router
│   ├── index.tsx
│   ├── chat.tsx
│   └── settings/
├── components/
├── lib/                     # tRPC client
└── app.json
```

## Import Patterns

### ✅ Good Imports

```typescript
// From runtime (after Phase 3)
import { WorkflowRuntime } from "@alfred/runtime";

// From agent (after Phase 5 restructure)
import { buildTools } from "@alfred/agent";

// From knowledge
import { KnowledgeGraph } from "@alfred/knowledge";

// From learning
import { record } from "@alfred/learning";
```

### ❌ Bad Imports

```typescript
// Never import implementation details
import { db } from "@alfred/knowledge/src/client"; // ❌

// Never import across layer boundaries incorrectly
import { WorkflowRuntime } from "@alfred/api"; // ❌ (runtime should not be in API)

// Never import upwards in dependency graph
import { tRPCRouter } from "@alfred/api"; // ❌ from knowledge package
```

## Package Addition Checklist

When adding a new package:

1. **Define Clear Purpose**
   - What does this package do?
   - Why can't it live in an existing package?

2. **Identify Dependencies**
   - What packages does it depend on?
   - Draw the dependency graph
   - Ensure no circular dependencies

3. **Create Package Structure**
   ```bash
   mkdir -p packages/new-package/{src,test}
   cd packages/new-package
   bun init
   ```

4. **Configure TypeScript**
   ```json
   {
     "extends": "@alfred/tsconfig/base.json",
     "compilerOptions": {
       "outDir": "./dist"
     },
     "include": ["src"]
   }
   ```

5. **Add to Workspace**
   ```json
   // package.json (root)
   "workspaces": ["packages/*", "apps/*"]
   ```

6. **Add to Turbo Config**
   ```json
   // turbo.json
   {
     "pipeline": {
       "build": {
         "dependsOn": ["^build"],
         "outputs": ["dist/**"]
       }
     }
   }
   ```

7. **Document in This File**
   - Add to dependency graph
   - Document purpose and exports
   - Provide usage examples

## Maintenance Guidelines

### When to Split a Package

Split when:
- Package exceeds 5000 lines
- Multiple unrelated concerns
- Clear reusable library emerges

### When to Merge Packages

Merge when:
- Packages always change together
- Artificial separation adds complexity
- No clear boundary between them

### When to Extract to Library

Extract when:
- Zero ALFRED-specific logic
- Useful to broader community
- Worth maintaining independently

## Related Documents

- [Architecture Overview](overview.md)
- [Decision Log](decisions.md)
- [PRD](../alfred-prd.md)

