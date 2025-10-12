# ALFRED Architecture v2 — Mastra-centric + Droids, tRPC + Drizzle + Postgres

Table of Contents
- [ALFRED Architecture v2 — Mastra-centric + Droids, tRPC + Drizzle + Postgres](#alfred-architecture-v2--mastra-centric--droids-trpc--drizzle--postgres)
  - [Executive Summary](#executive-summary)
  - [System Overview (Mermaid)](#system-overview-mermaid)
  - [Architecture Decisions \& Rationale](#architecture-decisions--rationale)
  - [Scaffold and Monorepo Layout](#scaffold-and-monorepo-layout)
    - [Domain-driven names \& layers](#domain-driven-names--layers)
  - [Component Responsibility Matrix](#component-responsibility-matrix)
  - [Data Layer: Drizzle + Postgres + pgvector + Graph Memory](#data-layer-drizzle--postgres--pgvector--graph-memory)
  - [Personalization \& Memory System](#personalization--memory-system)
    - [Data Model (Relational + Vector) and Migrations](#data-model-relational--vector-and-migrations)
    - [Mastra Memory: Working Memory + Semantic Recall + Custom Processors](#mastra-memory-working-memory--semantic-recall--custom-processors)
    - [Learning Workflows (Background)](#learning-workflows-background)
    - [Personalization Tools (User Control \& Safety)](#personalization-tools-user-control--safety)
    - [tRPC APIs: Profile, Preferences, Privacy](#trpc-apis-profile-preferences-privacy)
    - [UX Controls and Safety](#ux-controls-and-safety)
    - [Observability (Metrics)](#observability-metrics)
  - [Mastra Engine (packages/agent)](#mastra-engine-packagesagent)
    - [Mastra Instance Configuration](#mastra-instance-configuration)
    - [Agents: Tools, Guardrails, RuntimeContext, Memory](#agents-tools-guardrails-runtimecontext-memory)
    - [Personal Assistant Agent (packages/agent)](#personal-assistant-agent-packagesagent)
    - [Assistant Daily Workflows \& Tools](#assistant-daily-workflows--tools)
    - [Workflows: Control Flow, Loops, Suspend/Resume, Streaming](#workflows-control-flow-loops-suspendresume-streaming)
    - [RAG: Chunk → Embed → Store → Retrieve → Re-rank](#rag-chunk--embed--store--retrieve--re-rank)
    - [Streaming and Stream-to-Cache Handoff](#streaming-and-stream-to-cache-handoff)
    - [Observability: AI Tracing + OTEL](#observability-ai-tracing--otel)
  - [Orchestrator and Droids Integration](#orchestrator-and-droids-integration)
    - [Droid Exec Tool (Headless CLI Runner)](#droid-exec-tool-headless-cli-runner)
    - [Custom Droids (Subagents) Loader](#custom-droids-subagents-loader)
    - [Task Routing and Autonomy Policy](#task-routing-and-autonomy-policy)
    - [CI/CD: Automated Code Review with Droid Exec](#cicd-automated-code-review-with-droid-exec)
    - [Linear Integration (Agent Sessions, Webhooks, OAuth)](#linear-integration-agent-sessions-webhooks-oauth)
  - [Auth Model](#auth-model)
    - [End-user Auth (Better Auth + Passkeys)](#end-user-auth-better-auth--passkeys)
    - [Agent-to-Tool Auth (Ed25519 JWT, JWKS, Scopes)](#agent-to-tool-auth-ed25519-jwt-jwks-scopes)
  - [Policy \& Authorization (RBAC/ABAC + Obligations)](#policy--authorization-rbacabac--obligations)
    - [Policy model: RBAC + ABAC + obligations](#policy-model-rbac--abac--obligations)
    - [Policy configuration (YAML)](#policy-configuration-yaml)
    - [Policy Decision Point (PDP)](#policy-decision-point-pdp)
    - [Agent-to-tool JWT (claims \& elevation)](#agent-to-tool-jwt-claims--elevation)
    - [Database: Audit \& approvals](#database-audit--approvals)
    - [tRPC PEP: route-level policy enforcement](#trpc-pep-route-level-policy-enforcement)
    - [Mastra Tool PEP: JWT scopes + PDP](#mastra-tool-pep-jwt-scopes--pdp)
    - [Workflow obligations: suspend/resume](#workflow-obligations-suspendresume)
    - [Observability and audits](#observability-and-audits)
  - [tRPC Integration (packages/api)](#trpc-integration-packagesapi)
    - [Agent Procedures (generate/stream)](#agent-procedures-generatestream)
    - [Workflow Procedures (start/stream)](#workflow-procedures-startstream)
    - [Tool Procedures (JWT-protected: Droids/Proxmox)](#tool-procedures-jwt-protected-droidsproxmox)
    - [Droids Procedures (run/stream/list)](#droids-procedures-runstreamlist)
    - [Assistant Procedures (generate/stream/escalate)](#assistant-procedures-generatestreamescalate)
    - [Reminders Procedures (create/list)](#reminders-procedures-createlist)
    - [Slack Procedures (OAuth/install/read inbox)](#slack-procedures-oauthinstallread-inbox)
    - [Home Procedures (control whitelisted entities)](#home-procedures-control-whitelisted-entities)
    - [Voice Procedures (stt/tts)](#voice-procedures-stttts)
    - [Linear Procedures (oauth/install/webhooks)](#linear-procedures-oauthinstallwebhooks)
    - [Token Procedures (issue/elevate)](#token-procedures-issueelevate)
  - [Web, Desktop, Mobile Integration](#web-desktop-mobile-integration)
    - [TanStack Query Cache Handoff on Client](#tanstack-query-cache-handoff-on-client)
    - [Generative UI (Floating Orb) and Voice](#generative-ui-floating-orb-and-voice)
    - [Voice \& Call Flows (Assistant/Orchestrator)](#voice--call-flows-assistantorchestrator)
    - [Drive Mode (Mobile)](#drive-mode-mobile)
  - [Deployment Architecture (Beelink + Proxmox)](#deployment-architecture-beelink--proxmox)
    - [Monitoring \& Alerts (Prometheus, Grafana, Loki, Alertmanager)](#monitoring--alerts-prometheus-grafana-loki-alertmanager)
    - [Proxmox Provisioning \& App Deployments](#proxmox-provisioning--app-deployments)
    - [Provisioning Tools (Mastra + JWT scopes)](#provisioning-tools-mastra--jwt-scopes)
    - [App Deployments Data Model (DB)](#app-deployments-data-model-db)
    - [Deploy Procedures (tRPC): provision/build/run/route](#deploy-procedures-trpc-provisionbuildrunroute)
    - [Durability \& Ops (24/7)](#durability--ops-247)
  - [Recursive Self-Improvement (Laminar Evals \& Datasets)](#recursive-self-improvement-laminar-evals--datasets)
    - [Instrumentation: metadata, tags, and events](#instrumentation-metadata-tags-and-events)
    - [Datasets from traces (curation + labeling queues)](#datasets-from-traces-curation--labeling-queues)
    - [Evaluation harness and workflow](#evaluation-harness-and-workflow)
    - [A/B variants and rollout policy](#ab-variants-and-rollout-policy)
    - [Integration with personalization/feedback](#integration-with-personalizationfeedback)
    - [Ops integration (metrics \& alerts)](#ops-integration-metrics--alerts)
    - [Safety and governance](#safety-and-governance)
    - [Open questions](#open-questions)
  - [Dev/CI/CD](#devcicd)
    - [Local Postgres + pgvector via Docker](#local-postgres--pgvector-via-docker)
    - [Migrations and Seeds (RAG + Graph)](#migrations-and-seeds-rag--graph)
    - [Testing (Vitest), Linting, Turborepo Pipelines](#testing-vitest-linting-turborepo-pipelines)
  - [Milestones](#milestones)
  - [Risk Register and Mitigations](#risk-register-and-mitigations)
  - [Open Questions](#open-questions-1)
  - [Orchestrator Hierarchical Planning + Droids Execution Model](#orchestrator-hierarchical-planning--droids-execution-model)
    - [Plan artifacts and validation](#plan-artifacts-and-validation)
    - [Persistence and graph mapping](#persistence-and-graph-mapping)
    - [Orchestrator workflow (plan → schedule → execute → merge → docs → finalize)](#orchestrator-workflow-plan--schedule--execute--merge--docs--finalize)
    - [Git branching strategies and worktrees](#git-branching-strategies-and-worktrees)
    - [Dedicated Droid roles](#dedicated-droid-roles)
    - [Droids lifecycle](#droids-lifecycle)
    - [Web search and external docs](#web-search-and-external-docs)
    - [tRPC endpoints for orchestration](#trpc-endpoints-for-orchestration)
    - [Streaming and cache handoff](#streaming-and-cache-handoff)
    - [Observability](#observability)
    - [Risk considerations](#risk-considerations)
    - [Open items for stakeholder input](#open-items-for-stakeholder-input)
  - [Appendix A: Data Flow (Mermaid)](#appendix-a-data-flow-mermaid)
- [Selected Code Index](#selected-code-index)

---

## Executive Summary

ALFRED is a Mastra-first, domain-driven personal and engineering assistant that runs 24/7 on a Proxmox home-lab (Beelink GTi Ultra). It unifies a Fullstack TanStack Start app, type-safe tRPC API, Drizzle ORM, Postgres + pgvector, Redis, and a rich tool and workflow layer to deliver two high-level capabilities:
- Personal Assistant for daily work and life (notes, reminders, research, Slack inbox, home control, focus), and
- Orchestrator for software delivery (planning, code changes, review/merge, docs, deploy), powered by headless Droids.

Core architecture pillars
- Mastra-first runtime in-process: Agents, tools, memory, RAG, workflows (foreach/parallel/sequential/do-until), suspend/resume with snapshots, and streaming events. No separate Mastra HTTP server—Mastra is embedded in the TanStack server and invoked from tRPC procedures.
- Domain-driven layout and one-word names: Per-agent modules (assistant, orchestrator) with clear layering (domain/use/port/infra/ui), simple file/class/param names, and explicit boundaries between Personal Assistant and Orchestrator.

Agents and tools
- Assistant (daily workflows): notes, reminders, timers, bookmarks, Slack inbox (read-first), home control (whitelisted entities), web fetch (capped), focus mode, escalate handoff to Orchestrator. Assistant tools are scoped (assistant.read/write/escalate, web.read) and safe by default.
- Orchestrator (SWE + Droids): planning workflow that decomposes requirements into tasks and routes execution to Factory’s headless droid exec. Specialized "droids" roles for review/merge/docs; Git tools for branches/worktrees/commits/push; router/proxy tools for runtime routing; Linear tickets tool for project operations.

Execution and Droids
- Droids: Non-interactive "droid exec" is the primary SWE executor with autonomy levels (read/low/medium/high). Secure-by-default via short-lived JWT tool tokens (Ed25519) and PDP policy checks; streaming of stdout/debug events to the UI and Linear. Custom Droids (.factory/droids/*.md) are discoverable and callable.
- Workflows: Mastra workflows orchestrate plan → schedule (parallel via git worktrees or sequential) → execute → review/merge → docs → finalize with streaming updates and Stream-to-Cache Handoff packets to eliminate UI flicker.

Memory, personalization, and RAG
- Memory: Working memory + semantic recall (Postgres-backed) per agent; durable user personalization (profiles, preferences, facts vectors, events) with pgvector HNSW (cosine). Custom memory processors extract preferences and compress tool outputs; learning workflows (learn, distill) update durable memory over time.
- User controls: remember/correct/forget/export and autonomy policy sliders. All changes auditable; nothing is inferred without confidence thresholds and optional confirmation.
- RAG: ingest → chunk → embed → store (pgvector) → retrieve → re-rank. Tuned for OpenAI-class embeddings with cosine distance.

Security, policy, and auth
- Better Auth sessions + Passkeys for end-user auth and biometric gating at risky boundaries.
- Agent-to-tool JWT (Ed25519): short-lived tokens with scopes and claims (roles, mfa, elevated, maxAuto), JWKS exposure, jti replay defense, and caching.
- Policy & authorization (in-process PDP): RBAC + ABAC with obligations (e.g., require_biometric, limit_autonomy, require_manual_approval). Enforced at every PEP (tRPC routes, tools, workflows). Durable audits and approval queue for manual gates.

Integrations and project management
- Linear: OAuth actor=app, install per workspace, webhook signature verification, Agent Sessions (thought/action/elicitation/response/error) with app-as-delegate, and tickets tool for issue CRUD. Best practices: acknowledge within 10s, set delegate, move to started, emit activities as work progresses.

Deployment, provisioning, and runtime
- Proxmox (Beelink GTi Ultra): VM "alfred-core" runs the TanStack server + Mastra, Docker Postgres+pgvector, Redis, OTEL collector, and Laminar (LLM tracing UI). Plex runs in a separate LXC.
- App provisioning: Alfred builds and runs apps it develops (e.g., Next.js portfolio) using Docker and reverse proxy (Caddy) for preview subdomains and production routes. Optional LXC isolation via Proxmox tools. Deployments tracked in a DB table with health checks and rollback.
- Durability & ops: VM/LXC vzdump backups nightly; Postgres pg_dump daily; systemd supervision; Docker restart policies; secrets hygiene; Redis for token cache and jti defense.

Observability and monitoring
- Laminar for AI tracing (LLM spans, metadata, tokens, costs) and self-improvement evals/datasets.
- Prometheus + Grafana + Loki + Alertmanager for everything else: app/tRPC metrics, workflow/droid counters, Postgres/Redis/exporters, cAdvisor, reverse proxy metrics, blackbox probes, and Proxmox exporter. Alerts tuned for a single-user deployment.

Voice, UI, and mobile/desktop
- Web Dashboard: Chat (Assistant/Orchestrator switch), panes (Notes/Reminders/Slack/Home), floating orb, stream rendering, cache handoff.
- Speech-to-speech: Turn-based STT (Faster-Whisper) and TTS (Piper/Coqui) for safe drive-mode interactions; compact responses in motion.
- Mobile (React Native) and Desktop (Tauri): share tRPC endpoints; Drive Mode with large controls and voice-first flow.

Recursive self-improvement (Laminar)
- Datasets from traces and labeling queues; evaluations across variants (prompts, memory templates, tool descriptions, policies); A/B via tagged traces; promotion gated by thresholds and biometric-approved PRs. Never auto-widen scopes or autonomy.

What "end-to-end" looks like
1) Jack chats with Assistant for research, notes, and reminders; PA streams results and updates memory safely.
2) For SWE work, PA hands off via "handoff" tool to the Orchestrator.
3) Orchestrator plans tasks, runs Droids (read/low by default, medium/high only after biometric elevation), streams progress, updates Linear, and merges/docs/deploys when green.
4) Alfred can provision and route the resulting app into preview/production on the home-lab, and monitor/alert automatically.

ALFRED is designed to be private, durable, and incrementally better every week—personal when you need it, powerful when you ask for orchestration—while keeping security, auditability, and performance front and center.

---

## System Overview (Mermaid)

```mermaid
graph TD
  subgraph Clients
    WUI[Web (TanStack Start)]
    DESK[Tauri Desktop]
    MOB[React Native + NativeWind]
  end

  subgraph API (packages/api)
    TRPCs[tRPC Routers: agent, workflow, tool, droids, auth, linear]
    WH[HTTP Webhook Handler: /api/linear/webhook]
  **end**

  subgraph Engine (packages/agent)
    M(Mastra Instance)
    ORCH[Orchestrator Workflows]
    A[Agents + Tools + Guardrails + Memory]
    R[RAG: Chunk/Embed/Store/Retrieve/Re-rank]
    O[Observability: AI Tracing + OTEL]
    T[Droids Tool Runner]
  end

  subgraph Data (packages/db)
    DSchema[Drizzle Schema: app + rag + graph + linear]
  end

  subgraph Postgres
    PSQL[(Postgres + pgvector)]
  end

  subgraph Auth (packages/auth)
    JWTAuth[JWT Service: /token, /jwks]
  end

  subgraph Integrations
    PVE[Proxmox API]
    LINEAR[Linear API]
    LWEB[Linear Webhooks]
  end

  Clients --> TRPCs
  TRPCs --> M
  M --> ORCH
  M --> A
  M --> R
  M --> T
  DSchema --> PSQL
  M --> PSQL
  O --> PSQL
  TRPCs --> JWTAuth
  TRPCs --> LINEAR
  LWEB --> WH
  WH --> TRPCs
  M -->|agent activities| LINEAR
  T -->|controlled ops| PVE
  ORCH -->|tickets| LINEAR
```

---

## Architecture Decisions & Rationale

- Runtime and API: Fullstack TanStack Start with tRPC procedures invoked server-side; Mastra instance consumed in-process.
- Agents and Workflows: Mastra-native agents and workflows provide control-flow (foreach, dowhile, dountil), suspend/resume, snapshots, and streaming.
- Memory: Mastra memory for working memory and semantic recall with Postgres-backed storage. Orchestrator adds graph memory (nodes/edges) to track long-lived relationships among requirements, tasks, tickets, systems, and agents.
- RAG: pgvector-backed retrieval with optional semantic re-ranking using Mastra scorers.
- Streaming: Mastra event streams in tRPC subscriptions and TanStack Query cache handoff.
- Droids: Headless Droid Exec integrated as a Mastra Tool with strict auto levels (read-only → high) and scope enforcement. Custom Droids definitions (.factory/droids/*.md) are discoverable and invocable for targeted sub-tasks.
- Observability: Mastra AI Tracing default exporter for local development; optional Cloud/OTEL exporters.
- Security: auth for user sessions, biometrics for sensitive operations, and JWT-based agent-to-tool auth for protected tools (e.g., Proxmox and Droid Exec).

---

## Scaffold and Monorepo Layout

Scaffold with better-t-stack (TanStack Start, tRPC, Drizzle, Postgres, Bun):

```bash
bun create better-t-stack@latest alfred \
  --frontend tanstack-start \
  --native nativewind \
  --backend self \
  --runtime none \
  --api trpc \
  --auth auth \
  --payments none \
  --database postgres \
  --orm drizzle \
  --db-setup docker \
  --package-manager bun \
  --git \
  --web-deploy none \
  --server-deploy none \
  --install \
  --addons husky ruler turborepo ultracite \
  --examples ai todo
```

Monorepo structure (Domain-driven, Turborepo):

```
alfred/
├─ apps/
│  └─ web/                   # TanStack Start UI + tRPC client + auth UI
├─ packages/
│  ├─ api/                   # tRPC routers (rpc/*), ctx, gate (policy PEP), root
│  │  └─ src/
│  │     ├─ ctx.ts
│  │     ├─ gate.ts
│  │     ├─ root.ts
│  │     └─ rpc/
│  │        ├─ assistant.ts
│  │        ├─ orchestrator.ts
│  │        ├─ flow.ts
│  │        ├─ note.ts
│  │        ├─ remind.ts
│  │        ├─ timer.ts
│  │        ├─ book.ts
│  │        ├─ slack.ts
│  │        ├─ home.ts
│  │        ├─ deploy.ts
│  │        ├─ linear.ts
│  │        ├─ voice.ts
│  │        ├─ profile.ts
│  │        ├─ preference.ts
│  │        ├─ privacy.ts
│  │        ├─ jwks.ts
│  │        └─ token.ts
│  ├─ agent/
│  │  ├─ assistant/
│  │  │  └─ src/
│  │  │     ├─ agent.ts
│  │  │     ├─ flow/
│  │  │     │  └─ digest.ts
│  │  │     ├─ mem/
│  │  │     │  ├─ store.ts
│  │  │     │  ├─ preference.ts
│  │  │     │  └─ sum.ts
│  │  │     └─ tool/
│  │  │        ├─ note.ts
│  │  │        ├─ remind.ts
│  │  │        ├─ timer.ts
│  │  │        ├─ book.ts
│  │  │        ├─ slack.ts
│  │  │        ├─ home.ts
│  │  │        ├─ focus.ts
│  │  │        ├─ web.ts
│  │  │        └─ handoff.ts
│  │  └─ orchestrator/
│  │     └─ src/
│  │        ├─ agent.ts
│  │        ├─ flow/
│  │        │  └─ plan.ts
│  │        └─ tool/
│  │           ├─ droid.ts
│  │           ├─ git.ts
│  │           ├─ proxmox.ts
│  │           ├─ router.ts
│  │           ├─ ticket.ts
│  │           └─ web.ts
│  ├─ auth/
│  │  └─ src/
│  │     ├─ auth.ts
│  │     ├─ token.ts
│  │     ├─ jwks.ts
│  │     └─ key.ts
│  ├─ policy/
│  │  └─ src/
│  │     ├─ pdp.ts
│  │     ├─ rule.ts
│  │     ├─ load.ts
│  │     └─ decide.ts
│  ├─ db/
│  │  └─ src/
│  │     ├─ client.ts
│  │     ├─ schema/
│  │     │  ├─ user.ts
│  │     │  ├─ rag.ts
│  │     │  ├─ graph.ts
│  │     │  ├─ assistant.ts
│  │     │  ├─ linear.ts
│  │     │  └─ deploy.ts
│  │     └─ repo/
│  │        ├─ user.ts
│  │        ├─ rag.ts
│  │        ├─ graph.ts
│  │        ├─ assistant.ts
│  │        ├─ linear.ts
│  │        └─ deploy.ts
│  ├─ rag/
│  │  └─ src/
│  │     └─ doc.ts
│  ├─ ui/
│  │  └─ src/
│  │     ├─ chat/
│  │     │  ├─ chat.tsx
│  │     │  └─ orb.tsx
│  │     └─ pane/
│  │        ├─ note.tsx
│  │        ├─ remind.tsx
│  │        ├─ slack.tsx
│  │        └─ home.tsx
│  └─ type/
│     └─ src/
│        ├─ plan.ts
│        └─ msg.ts
├─ config/
│  └─ policy.yaml
├─ docker/
│  ├─ postgres/
│  └─ monitoring/
├─ turbo.json
├─ package.json
└─ bun.lockb
```

tsconfig.base.json:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@alfred/api/*": ["packages/api/src/*"],
      "@alfred/assistant/*": ["packages/agent/assistant/src/*"],
      "@alfred/orchestrator/*": ["packages/agent/orchestrator/src/*"],
      "@alfred/agent/*": ["packages/agent/*/src/*"],
      "@alfred/auth/*": ["packages/auth/src/*"],
      "@alfred/policy/*": ["packages/policy/src/*"],
      "@alfred/db/*": ["packages/db/src/*"],
      "@alfred/rag/*": ["packages/rag/src/*"],
      "@alfred/ui/*": ["packages/ui/src/*"],
      "@alfred/type/*": ["packages/type/src/*"]
    }
  }
}
```

### Domain-driven names & layers

- One-word names only (files, classes, params). Nouns only; no adjectives.
- Framework-required filenames (e.g., `_layout.tsx`, `+not-found.tsx`) and UI ergonomics (`use-color-scheme.ts`) are the only allowed exceptions per `.ruler/01-naming-conventions.md`; keep everything else single word.
- Agents are separate modules: assistant and orchestrator. Agent IDs: "assistant", "orchestrator".
- Layers per domain:
  - domain (types, rules), use (flows), port (interfaces/tools), infra (adapters), ui (components).
- Param naming (examples):
  - user → user, run → run, space → space, token → token, refresh → refresh, uri → uri, app → app, auto → auto, cw → cw.
- Workflow ids: plan (orchestrator), digest (assistant).
- Tool names: note, remind, timer, book, slack, home, focus, web, handoff, droid, git, proxmox, router, ticket.

---

## Component Responsibility Matrix

- apps/web: Renders UI (Aceternity/Magic UI + floating orb), calls tRPC, manages TanStack Query cache, speech stack integration, biometric prompts for sensitive actions.
- packages/api: Owns tRPC routers for agents, orchestrator workflows, tools, Droids, and JWT auth/JWKS exposure; provides streaming endpoints.
- packages/agent: Single Mastra instance including agents, orchestrator workflows, Droids/proxmox tools, memory config, RAG glue, and observability.
- packages/db: Drizzle schema (pgvector tables + graph memory), migrations, repositories for RAG and graph memory, general app tables.
- packages/auth: JWT-based agent-to-tool auth (Ed25519) with token exchange (/token), JWKS (/jwks), scope checks, and caching.
- packages/ui: Shared UI components (chat, telemetry, live streams, orb animations).

---

## Data Layer: Drizzle + Postgres + pgvector + Graph Memory

Enable pgvector and create both RAG and graph memory schemas.

docker/postgres/docker-compose.yml:
```yaml
version: "3.9"
services:
  pg:
    image: pgvector/pgvector:pg16
    container_name: alfred_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: alfred
      POSTGRES_PASSWORD: alfred
      POSTGRES_DB: alfred
    ports:
      - "5432:5432"
    volumes:
      - ./data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U alfred -d alfred"]
      interval: 5s
      timeout: 5s
      retries: 10
```

packages/db/src/schema.ts:
```ts
import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, real, vector } from "drizzle-orm/pg-core"; // use pg-core vector helper to avoid SSR bundling issues

export const VECTOR_DIM = 1536;

// RAG tables
export const ragDocuments = pgTable("rag_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  title: text("title"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

export const ragChunks = pgTable("rag_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => ragDocuments.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  order: integer("\"order\"").notNull().default(0),
  embedding: vector("embedding", { dimensions: VECTOR_DIM }),
});

// Graph memory tables (Orchestrator knowledge graph)
export const memoryNodes = pgTable("memory_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(), // e.g., "requirement", "ticket", "system", "agent", "vm"
  label: text("label").notNull(),
  properties: jsonb("properties"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const memoryEdges = pgTable("memory_edges", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromId: uuid("from_id").notNull().references(() => memoryNodes.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => memoryNodes.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // e.g., "relates_to", "blocks", "assigned_to", "runs_on"
  weight: real("weight").default(1.0),
  metadata: jsonb("metadata"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

packages/db/src/migrations/0000_extensions.sql:
```sql
-- Core extensions required by migrations
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
```

packages/db/src/migrations/0001_init.sql:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  title text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  "order" int NOT NULL DEFAULT 0
);

-- Use cosine distance for OpenAI-style embeddings
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw
ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- Graph memory
CREATE TABLE IF NOT EXISTS memory_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  label text NOT NULL,
  properties jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  kind text NOT NULL,
  weight real DEFAULT 1.0,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_nodes_kind_idx ON memory_nodes(kind);
CREATE INDEX IF NOT EXISTS memory_edges_kind_idx ON memory_edges(kind);
CREATE INDEX IF NOT EXISTS memory_edges_from_to_idx ON memory_edges(from_id, to_id);
```

packages/db/src/migrations/0002_linear.sql:
```sql
CREATE TABLE IF NOT EXISTS linear_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_client_id text NOT NULL,
  app_user_id text NOT NULL,
  workspace_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  scope text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS linear_installations_workspace_idx ON linear_installations(workspace_id);
CREATE INDEX IF NOT EXISTS linear_installations_oauth_idx ON linear_installations(oauth_client_id);
```

packages/db/src/migrations/0003_assistant.sql:
```sql
CREATE TABLE IF NOT EXISTS assistant_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_tasks_user_idx ON assistant_tasks(user_id);

CREATE TABLE IF NOT EXISTS assistant_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text,
  body text NOT NULL,
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_notes_user_idx ON assistant_notes(user_id);

CREATE TABLE IF NOT EXISTS assistant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  attendees text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_events_user_idx ON assistant_events(user_id);
```

packages/db/src/migrations/0007_assistant_productivity.sql:
```sql
-- Reminders / alarms
CREATE TABLE IF NOT EXISTS assistant_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  recurring text,
  channel text NOT NULL DEFAULT 'in-app',   -- 'in-app'|'slack'|'voice'
  payload jsonb,
  status text NOT NULL DEFAULT 'scheduled', -- 'scheduled'|'fired'|'cancelled'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_reminders_user_due_idx ON assistant_reminders(user_id, due_at, status);

-- Bookmarks / read later
CREATE TABLE IF NOT EXISTS assistant_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  url text NOT NULL,
  title text,
  tags text[],
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_bookmarks_user_idx ON assistant_bookmarks(user_id);

-- Timers (short-lived)
CREATE TABLE IF NOT EXISTS assistant_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  label text,
  start_at timestamptz NOT NULL DEFAULT now(),
  duration_sec int NOT NULL,
  status text NOT NULL DEFAULT 'running', -- 'running'|'finished'|'cancelled'
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_timers_user_idx ON assistant_timers(user_id, status);
```

packages/db/src/migrations/0008_indexes.sql:
```sql
CREATE INDEX IF NOT EXISTS assistant_tasks_user_status_idx ON assistant_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS assistant_tasks_user_due_idx ON assistant_tasks(user_id, due_at);
CREATE INDEX IF NOT EXISTS assistant_reminders_user_due_fired_idx ON assistant_reminders(user_id, due_at, status);
CREATE INDEX IF NOT EXISTS assistant_timers_user_end_completed_idx ON assistant_timers(user_id, status, duration_sec);
```

packages/db/src/migrations/0009_uniques.sql:
```sql
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_key_unique UNIQUE (user_id, key);
ALTER TABLE user_autonomy ADD CONSTRAINT user_autonomy_user_action_unique UNIQUE (user_id, action);
ALTER TABLE linear_installations ADD CONSTRAINT linear_installations_user_org_unique UNIQUE (user_id, organization_id);
```

packages/db/src/migrations/0010_vector_index.sql:
```sql
CREATE INDEX IF NOT EXISTS user_facts_embedding_hnsw ON user_facts USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw ON rag_chunks USING hnsw (embedding vector_cosine_ops);
```

packages/db/src/migrations/0011_passkey.sql:
```sql
-- Better Auth tables for WebAuthn/Passkey support
CREATE TABLE IF NOT EXISTS passkey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

packages/db/src/repository.ts:
```ts
import { db } from "./client";
import { ragDocuments, ragChunks, memoryNodes, memoryEdges } from "./schema";
import { sql, eq } from "drizzle-orm";

// RAG helpers
export async function insertDocument(source: string, title?: string, metadata?: unknown) {
  const [doc] = await db.insert(ragDocuments).values({ source, title, metadata }).returning();
  return doc;
}

export async function insertChunk(documentId: string, content: string, order: number, embedding: number[]) {
  await db.execute(sql`
    INSERT INTO rag_chunks (document_id, content, "order", embedding)
    VALUES (${documentId}, ${content}, ${order}, ${embedding}::vector)
  `);
}

export async function querySimilar(embedding: number[], topK = 5) {
  return await db.execute(sql`
    SELECT id, document_id, content,
           1 - (embedding <=> ${embedding}::vector) AS score
    FROM rag_chunks
    ORDER BY embedding <=> ${embedding}::vector ASC
    LIMIT ${topK};
  `);
}

// Graph helpers
export async function upsertNode(kind: string, label: string, properties: unknown = {}) {
  const [node] = await db.insert(memoryNodes).values({ kind, label, properties }).returning();
  return node;
}

export async function addEdge(fromId: string, toId: string, kind: string, weight = 1.0, metadata: unknown = {}) {
  const [edge] = await db.insert(memoryEdges).values({ fromId, toId, kind, weight, metadata }).returning();
  return edge;
}
```

packages/db/src/repo/linear.ts (additional helpers):
```ts
import { db } from "./client";
import { linearInstallations } from "./schema";
import { eq, sql } from "drizzle-orm";

export async function upsertLinearInstallation(input: {
  oauthClient: string;
  appUser: string;
  space: string;
  token: string;
  refresh?: string | null;
  scope: string;
  expires?: Date | null;
}) {
  const now = new Date();
  await db.execute(sql`
    INSERT INTO linear_installations (oauth_client_id, app_user_id, workspace_id, access_token, refresh_token, scope, expires_at, created_at, updated_at)
    VALUES (${input.oauthClient}, ${input.appUser}, ${input.space}, ${input.token}, ${input.refresh ?? null}, ${input.scope}, ${input.expires ?? null}, ${now}, ${now})
    ON CONFLICT (workspace_id) DO UPDATE
      SET access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          scope = EXCLUDED.scope,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at
  `);
}

export async function getLinearInstallationByWorkspace(space: string) {
  const rows = await db.select().from(linearInstallations).where(eq(linearInstallations.space, space)).limit(1);
  return rows[0] || null;
}

export async function getLinearInstallationByOAuthClientId(oauthClient: string) {
  const rows = await db.select().from(linearInstallations).where(eq(linearInstallations.oauthClient, oauthClient)).limit(1);
  return rows[0] || null;
}
```

---

## Personalization & Memory System

Alfred continuously learns about Jack (the sole user) to become a better Personal Assistant and Orchestrator while preserving strong safety, consent, and privacy controls. This system builds on Mastra’s memory primitives (working memory, conversation history, semantic recall) and adds a durable relational + vector-backed personalization store, background learning workflows, and user-facing controls to review, correct, forget, and export data.

Key goals
- Learn preferences, habits, and constraints over time from conversations, tool results, and workflows.
- Keep a shared, stable "User Profile" usable by both agents; maintain separate agent-specific working memories.
- Provide clear user controls: remember, correct, forget (purge), export.
- Enable guided self-improvement via offline evals and policy/prompt improvements (human-approved).

### Data Model (Relational + Vector) and Migrations

Add durable personalization tables alongside existing app tables. Use pgvector for semantic facts and HNSW (cosine) for recall.

packages/db/src/migrations/0005_personalization.sql:
```sql
-- Personalization: core profile, preferences, facts, events, auto policies, feedback
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  source text NOT NULL DEFAULT 'conversation', -- conversation|tool|manual|workflow
  confidence real NOT NULL DEFAULT 0.5,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE TABLE IF NOT EXISTS user_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  text text NOT NULL,
  kind text NOT NULL,               -- personal|habit|policy|device|schedule
  confidence real NOT NULL DEFAULT 0.5,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- HNSW cosine index for vector recall
CREATE INDEX IF NOT EXISTS user_facts_embedding_hnsw
ON user_facts USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type text NOT NULL,               -- chat|tool_call|workflow_run|deploy|drive_mode|...
  payload jsonb NOT NULL,
  ts timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_events_user_idx ON user_events (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS user_events_type_idx ON user_events (type);

CREATE TABLE IF NOT EXISTS user_auto_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  agent text NOT NULL,              -- personal|orchestrator
  min_auto text NOT NULL DEFAULT 'read',
  max_auto text NOT NULL DEFAULT 'low',
  requireBio_for text[] NOT NULL DEFAULT ARRAY['auto:medium','auto:high'],
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, agent)
);

CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  target text NOT NULL,             -- message:<id>|run:<id>|tool:<name>
  rating int NOT NULL,              -- -1|0|1
  comment text,
  created_at timestamptz DEFAULT now()
);
```

packages/db/src/schema/user.ts (append to schema.ts in implementation):
```ts
import { pgTable, text, timestamp, uuid, jsonb, integer, real, vector } from "drizzle-orm/pg-core";

export const userProfiles = pgTable("user_profiles", {
  user: text("user_id").primaryKey(),
  profile: jsonb("profile_json").notNull().default({}),
  version: integer("version").notNull().default(1),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  user: text("user_id").notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  source: text("source").notNull().default("conversation"),
  confidence: real("confidence").notNull().default(0.5),
  last: timestamp("last_seen", { withTimezone: true }).defaultNow(),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  // unique (user_id, key) handled by migration
});

export const userFacts = pgTable("user_facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  user: text("user_id").notNull(),
  text: text("text").notNull(),
  kind: text("kind").notNull(),
  confidence: real("confidence").notNull().default(0.5),
  embedding: vector("embedding", { dimensions: 1536 }),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userEvents = pgTable("user_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  user: text("user_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow(),
});

export const userAutonomyPolicies = pgTable("user_auto_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  user: text("user_id").notNull(),
  agent: text("agent").notNull(),
  minAuto: text("min_auto").notNull().default("read"),
  maxAuto: text("max_auto").notNull().default("low"),
  requireBio: jsonb("requireBio_for").$type<string[]>().notNull().default(['auto:medium','auto:high'] as any),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userFeedback = pgTable("user_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  user: text("user_id").notNull(),
  target: text("target").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

packages/db/src/repo/user.ts (helpers):
```ts
import { db } from "./client";
import { sql, eq, and } from "drizzle-orm";
import { userProfiles, userPreferences, userFacts, userEvents, userAutonomyPolicies, userFeedback } from "./schema";

export async function getUserProfile(user: string) {
  const rows = await db.select().from(userProfiles).where(eq(userProfiles.user, user)).limit(1);
  return rows[0] || null;
}

export async function upsertUserProfile(user: string, profile: unknown, version: number) {
  const now = new Date();
  await db.execute(sql`
    INSERT INTO user_profiles (user_id, profile_json, version, updated_at)
    VALUES (${user}, ${profile}, ${version}, ${now})
    ON CONFLICT (user_id) DO UPDATE
      SET profile_json = EXCLUDED.profile_json,
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at
  `);
}

export async function upsertPreference(input: { user: string; key: string; value: unknown; source?: string; confidence?: number }) {
  const now = new Date();
  await db.execute(sql`
    INSERT INTO user_preferences (user_id, key, value, source, confidence, last_seen, created_at, updated_at)
    VALUES (${input.user}, ${input.key}, ${input.value}, ${input.source ?? "manual"}, ${input.confidence ?? 0.7}, ${now}, ${now}, ${now})
    ON CONFLICT (user_id, key) DO UPDATE
      SET value = EXCLUDED.value,
          source = EXCLUDED.source,
          confidence = GREATEST(user_preferences.confidence, EXCLUDED.confidence),
          last_seen = EXCLUDED.last_seen,
          updated_at = EXCLUDED.updated_at
  `);
}

export async function insertFact(input: { user: string; text: string; kind: string; confidence?: number; embedding: number[] }) {
  const now = new Date();
  const [row] = await db.execute(sql`
    INSERT INTO user_facts (user_id, text, kind, confidence, embedding, created_at, updated_at)
    VALUES (${input.user}, ${input.text}, ${input.kind}, ${input.confidence ?? 0.6}, ${input.embedding}::vector, ${now}, ${now})
    RETURNING id
  `);
  return (row as any)?.id ?? null;
}

export async function queryFactsByEmbedding(user: string, embedding: number[], topK = 5) {
  return await db.execute(sql`
    SELECT id, text, kind,
           1 - (embedding <=> ${embedding}::vector) AS score
    FROM user_facts
    WHERE user_id = ${user}
    ORDER BY embedding <=> ${embedding}::vector ASC
    LIMIT ${topK}
  `);
}

export async function insertEvent(event: { user: string; type: string; payload: unknown; ts?: Date }) {
  await db.insert(userEvents).values({ user: event.user, type: event.type, payload: event.payload, ts: event.ts ?? new Date() });
}

export async function getAutonomyPolicy(user: string, agent: "personal"|"orchestrator") {
  const rows = await db.select().from(userAutonomyPolicies).where(and(eq(userAutonomyPolicies.user, user), eq(userAutonomyPolicies.agent, agent))).limit(1);
  return rows[0] || null;
}

export async function setAutonomyPolicy(input: { user: string; agent: "personal"|"orchestrator"; minAuto?: string; maxAuto?: string; requireBio?: string[] }) {
  const now = new Date();
  await db.execute(sql`
    INSERT INTO user_auto_policies (user_id, agent, min_auto, max_auto, requireBio_for, updated_at)
    VALUES (${input.user}, ${input.agent}, ${input.minAuto ?? "read"}, ${input.maxAuto ?? "low"}, ${JSON.stringify(input.requireBio ?? ['auto:medium','auto:high'])}::jsonb, ${now})
    ON CONFLICT (user_id, agent) DO UPDATE
      SET min_auto = EXCLUDED.min_auto,
          max_auto = EXCLUDED.max_auto,
          requireBio_for = EXCLUDED.requireBio_for,
          updated_at = EXCLUDED.updated_at
  `);
}

export async function insertFeedback(input: { user: string; target: string; rating: number; comment?: string }) {
  await db.insert(userFeedback).values({ user: input.user, target: input.target, rating: input.rating, comment: input.comment ?? null });
}
```

### Mastra Memory: Working Memory + Semantic Recall + Custom Processors

Each agent uses resource-scoped working memory and semantic recall. Add custom processors to extract preferences/facts (non-mutating) and compress tool outputs while keeping a TokenLimiter last.

packages/agent/src/memory/processors.ts (concept):
```ts
import { MemoryProcessor } from "@mastra/core/memory";
import type { CoreMessage, MemoryProcessorOpts } from "@mastra/core";

export class PreferenceExtractor extends MemoryProcessor {
  constructor(private opts: { minConfidence: number } = { minConfidence: 0.6 }) {
    super({ name: "PreferenceExtractor" });
  }
  process(messages: CoreMessage[], _opts?: MemoryProcessorOpts) {
    // Inspect messages to detect statements like "I prefer X", "Keep replies short while driving", etc.
    // Emit side-channel events (e.g., via a repository call or writer in the agent context) in workflows.
    return messages;
  }
}

export class ToolEventSummarizer extends MemoryProcessor {
  constructor() { super({ name: "ToolEventSummarizer" }); }
  process(messages: CoreMessage[]) {
    // Collapse verbose tool results into brief summaries retained in memory
    return messages;
  }
}
```

### Learning Workflows (Background)

Create periodic and on-demand workflows to consolidate signals into durable memory.

packages/agent/src/workflows/digest.ts (outline):
```ts
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { insertEvent, upsertPreference, insertFact } from "@alfred/db/repo/user";

const collectEvents = createStep({
  id: "collect-events",
  inputSchema: z.object({ user: z.string(), since: z.string().optional() }),
  outputSchema: z.object({ events: z.array(z.any()) }),
  execute: async ({ inputData }) => {
    // Load user events and recent chats/tool outputs
    return { events: [] };
  },
});

const extractPreferences = createStep({
  id: "extract-preferences",
  inputSchema: z.object({ events: z.array(z.any()) }),
  outputSchema: z.object({ prefs: z.array(z.object({ key: z.string(), value: z.any(), confidence: z.number() })) }),
  execute: async ({ inputData }) => {
    // Use LLM to propose preferences based on events
    return { prefs: [] };
  },
});

const validateAndPersist = createStep({
  id: "validate-and-persist",
  inputSchema: z.object({ user: z.string(), prefs: z.array(z.object({ key: z.string(), value: z.any(), confidence: z.number() })) }),
  outputSchema: z.object({ updated: z.number() }),
  execute: async ({ inputData }) => {
    let updated = 0;
    for (const p of inputData.prefs) {
      await upsertPreference({ user: inputData.user, key: p.key, value: p.value, confidence: p.confidence, source: "workflow" });
      updated++;
    }
    return { updated };
  },
});

export const learnUserWorkflow = createWorkflow({
  id: "learn",
  description: "Consolidate user preferences and facts from recent events",
  inputSchema: z.object({ user: z.string(), since: z.string().optional() }),
  outputSchema: z.object({ updated: z.number() }),
})
  .then(collectEvents)
  .then(extractPreferences)
  .then(validateAndPersist)
  .map(({ getStepResult }) => ({ updated: getStepResult(validateAndPersist).updated }))
  .commit();
```

### Personalization Tools (User Control & Safety)

Add safe, auditable tools to mutate user memory. These are exposed to the Personal Assistant agent, not to the Orchestrator directly.

packages/agent/src/tools/profile.ts:
```ts
import { z } from "zod";
import { upsertPreference, getAutonomyPolicy, setAutonomyPolicy, upsertUserProfile } from "@alfred/db/repo/user";

export const toolRemember = {
  name: "remember",
  description: "Remember a user preference or fact",
  inputSchema: z.object({ key: z.string(), value: z.any(), confidence: z.number().min(0).max(1).optional() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }: any) => {
    const user = context?.user || "user";
    await upsertPreference({ user, key: input.key, value: input.value, confidence: input.confidence ?? 0.8, source: "manual" });
    return { ok: true };
  },
};

export const toolAutonomySet = {
  name: "auto.set",
  description: "Set auto policy for an agent",
  inputSchema: z.object({
    agent: z.enum(["personal","orchestrator"]),
    minAuto: z.enum(["read","low","medium","high"]).optional(),
    maxAuto: z.enum(["read","low","medium","high"]).optional(),
    requireBio: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }: any) => {
    const user = context?.user || "user";
    await setAutonomyPolicy({ user, agent: input.agent, minAuto: input.minAuto, maxAuto: input.maxAuto, requireBio: input.requireBio });
    return { ok: true };
  },
};

export const toolProfileUpdate = {
  name: "profile.update",
  description: "Update the stable user profile",
  inputSchema: z.object({ patch: z.record(z.any()) }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }: any) => {
    const user = context?.user || "user";
    const currentVersion = 1;
    await upsertUserProfile(user, input.patch, currentVersion + 1);
    return { ok: true };
  },
};
```

### tRPC APIs: Profile, Preferences, Privacy

Expose server APIs for UI control over personalization.

packages/api/src/rpc/profile.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { getUserProfile, upsertUserProfile } from "@alfred/db/repo/user";

export const profileRouter = router({
  get: authedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const user = ctx.session.user.id;
    return (await getUserProfile(user)) ?? { user, profile: {}, version: 1 };
  }),
  update: authedProcedure.input(z.object({ patch: z.record(z.any()) })).mutation(async ({ input, ctx }) => {
    const user = ctx.session.user.id;
    const current = await getUserProfile(user);
    const nextVersion = (current?.version ?? 1) + 1;
    await upsertUserProfile(user, { ...(current?.profile ?? {}), ...input.patch }, nextVersion);
    return { ok: true, version: nextVersion };
  }),
});
```

packages/api/src/rpc/preference.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { upsertPreference } from "@alfred/db/repo/user";

export const preferencesRouter = router({
  set: authedProcedure.input(z.object({ key: z.string(), value: z.any(), confidence: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      await upsertPreference({ user: ctx.session.user.id, key: input.key, value: input.value, confidence: input.confidence, source: "manual" });
      return { ok: true };
    }),
});
```

packages/api/src/rpc/privacy.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@alfred/db/client";
import { userPreferences, userFacts, userEvents } from "@alfred/db/schema";

export const privacyRouter = router({
  purge: authedProcedure.input(z.object({ scope: z.enum(["all","prefs","facts","events"]) }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.session.user.id;
      if (input.scope === "all" || input.scope === "prefs") await db.delete(userPreferences).where(userPreferences.user.eq(user) as any);
      if (input.scope === "all" || input.scope === "facts") await db.delete(userFacts).where(userFacts.user.eq(user) as any);
      if (input.scope === "all" || input.scope === "events") await db.delete(userEvents).where(userEvents.user.eq(user) as any);
      return { ok: true };
    }),
});
```

### UX Controls and Safety

- Profile & Preferences page: "Teach Alfred" (remember), auto policy sliders, "Review & Correct", "Export my data", "Erase selected data".
- Chat feedback (thumbs up/down) writes to user_feedback; corrections route to preferences/tools.
- Orchestrator reads stable profile and preferences but does not mutate them directly.

### Observability (Metrics)

Instrument personalization to monitor learning health and safety:
- memory_updates_total{kind="preference"|"fact"|"profile", source="chat"|"tool"|"manual"|"workflow"}
- memory_forgets_total{scope}
- learning_workflow_runs_total{status}
- profile_version{user}

Wire via prom-client in the API and increment around workflow runs and tool calls. Alert on unusual spikes or repeated failures.

---

## Mastra Engine (packages/agent)

### Mastra Instance Configuration

packages/agent/src/index.ts:
```ts
import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { DefaultExporter, CloudExporter } from "@mastra/core/ai-tracing";
import { SensitiveDataFilter } from "@mastra/core/ai-tracing";
import { agents } from "./agents";
import { workflows } from "./workflows";
import { tools } from "./tools";
import { pgConnectionString } from "./lib/env";

const storage = new PostgresStore({
  connectionString: pgConnectionString,
});

export const mastra = new Mastra({
  agents,
  workflows,
  server: {},
  storage,
  observability: {
    configs: {
      default: {
        serviceName: "alfred-engine",
        processors: [new SensitiveDataFilter()],
        exporters: [
          new DefaultExporter(),
          ...(process.env.MASTRA_CLOUD_ACCESS_TOKEN ? [new CloudExporter()] : []),
        ],
      },
    },
    default: { enabled: true },
  },
});
```

### Agents: Tools, Guardrails, RuntimeContext, Memory

packages/agent/src/agents.ts:
```ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { PostgresStore } from "@mastra/pg";
import { UnicodeNormalizer, ModerationProcessor } from "@mastra/core/processors";
import { toolWeather } from "./tools/weather";
import { toolTickets } from "./tools/ticket";
import { toolDroidExec } from "./tools/droid";
import { toolProxmox } from "./tools/proxmox";

// Personal Assistant tools (examples)
import { toolAssistantTodos } from "./tools/todo";
import { toolAssistantNotes } from "./tools/note";
import { toolAssistantCalendar } from "./tools/calendar";
import { toolAssistantRecall } from "./tools/recall";
import { toolWebFetch } from "./tools/web";
import { toolEscalateToOrchestrator } from "./tools/handoff";

const memory = new Memory({
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL! }),
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
      scope: "resource",
      template: `# User Profile
- Name:
- Location:
- Preferences:
- Long-term Goals:
`,
    },
    semanticRecall: { topK: 5, messageRange: 2, scope: "resource" },
  },
});

// Orchestrator agent (SWE + Droids)
export const alfredAgent = new Agent({
  name: "alfred",
  description: "Jarvis-like assistant orchestrating agents and Droids",
  instructions: [
    { role: "system", content: "You are ALFRED. Be concise, safe, and proactive. Delegate to tools and Droids." },
  ],
  model: "openai/gpt-4o-mini",
  memory,
  inputProcessors: [
    new UnicodeNormalizer({ stripControlChars: true, collapseWhitespace: true }),
    new ModerationProcessor({ model: openai("gpt-4.1-nano"), threshold: 0.7, strategy: "warn" }),
  ],
  tools: {
    weather: toolWeather,
    tickets: toolTickets,
    droidExec: toolDroidExec,
    proxmox: toolProxmox,
  },
});

// Personal Assistant agent (general productivity, notes, reminders, quick research)
const paMemory = new Memory({
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL! }),
  options: {
    lastMessages: 25,
    workingMemory: {
      enabled: true,
      scope: "resource",
      template: `# User Profile
- Name:
- Role:
- Typical work hours:
- Preferences:
- Current priorities:
`,
    },
    semanticRecall: { topK: 5, messageRange: 2, scope: "resource" },
  },
});

export const personalAssistantAgent = new Agent({
  name: "assistant",
  description: "Personal assistant for planning, notes, reminders, quick research; can escalate to Orchestrator.",
  instructions: [
    { role: "system", content: "You are ALFRED Personal. Help with tasks, notes, reminders, and quick research. Be concise and proactive. Escalate SWE tasks to the Orchestrator via the handoff tool." },
  ],
  model: "openai/gpt-4o-mini",
  memory: paMemory,
  inputProcessors: [
    new UnicodeNormalizer({ stripControlChars: true, collapseWhitespace: true }),
    new ModerationProcessor({ model: openai("gpt-4.1-nano"), threshold: 0.7, strategy: "warn" }),
  ],
  tools: {
    todos: toolAssistantTodos,
    notes: toolAssistantNotes,
    calendar: toolAssistantCalendar,
    recall: toolAssistantRecall,
    reminders: toolAssistantReminders,
    timers: toolAssistantTimers,
    bookmarks: toolAssistantBookmarks,
    slackInbox: toolSlackInbox, // read-only Slack mentions/DMs
    homeControl: toolHomeControl, // whitelisted Home Assistant control (policy-gated)
    focus: toolAssistantFocus,
    web: toolWebFetch, // read-only web fetch with size cap
    handoff: toolEscalateToOrchestrator, // bridge to orchestrator workflow
  },
});

export const agents = { alfred: alfredAgent, personal: personalAssistantAgent };
```

### Personal Assistant Agent (packages/agent)

- Purpose: daily "personal assistant" for non-SWE tasks (planning, todos, notes, reminders, quick research).
- Separation of concerns:
  - Personal Assistant uses only assistant-scoped tools (assistant.read/write, web.read).
  - Orchestrator owns SWE tooling (Droids/Proxmox/repo) and Linear/CI flows.
  - Crossing the boundary occurs via a single audited tool: handoff.
- Escalation:
  - The Personal Assistant may invoke the handoff tool with a requirement string; the tool starts the plan with auto=read/low by default.
  - Higher auto (medium/high) requires a biometric-gated elevated token (see Auth Model), passed as Bearer authz to the tool and enforced server-side.
- Memory:
  - Resource-scoped working memory (user profile/preferences/priorities) and semantic recall across notes and conversations.
  - Orchestrator keeps its own memory; cross-linking through graph memory nodes/edges.

### Assistant Daily Workflows & Tools

The Personal Assistant (PA) supports daily routines with safe, auditable tools that never cross into SWE/infra domains. These tools are limited by assistant.* scopes, policy rules, and optional biometric gating for sensitive actions.

- Notes and Recall
  - Create, list, and search notes; semantic recall over saved notes.
  - Emits data-cache-handoff on updates to keep the UI in sync without flicker.

- Reminders and Alarms
  - Schedule reminders with due times and channels: in-app, Slack (optional), or voice prompt.
  - In-process scheduler (single-node) scans due reminders periodically and triggers notifications. Opt-in via `SCHED_REMIND=1`; runs server-side only, adds jitter to avoid aligned wake-ups, and cleans up timers during Vite HMR.
  - Misfire handling on server restart (catch-up window).

- Timers (Pomodoro/focus timers)
  - Start/cancel short timers; notify on completion.
  - Focus mode toggles "short response" policy in runtimeContext and memory templates.

- Bookmarks / Read Later
  - Save URLs with optional title and tags.
  - List and filter; recall common topics later.

- Slack Inbox (read-only by default)
  - List recent DMs/mentions safely via bot token.
  - Optional post capabilities (slack.post) gated by policy (e.g., requireBio).

- Home Automation (Home Assistant)
  - Read/control whitelisted entities only (e.g., light.kitchen).
  - Sensitive entities (e.g., locks, garage) require biometric elevation and explicit allowlist.
  - All calls audited and policy-enforced at the tool boundary.

- Focus Mode
  - Toggle focus mode with optional duration; reduce verbosity and supress non-essential notifications.

Scopes and policy (examples)
- assistant.read, assistant.write, assistant.escalate
- web.read (small capped fetch for research)
- slack.read (read inbox); slack.post (optional, biometric-gated)
- home.read, home.control (biometric-gated for sensitive entities)
- timers.write, reminders.write

Metrics (Prometheus)
- reminders_created_total, reminders_fired_total
- timers_started_total
- slack_fetch_total{status}, home_control_total{entity,action,status}
- assistant_focus_mode_enabled_total

Security and privacy
- Secrets (Slack/Home Assistant tokens) stored securely; never logged.
- All tool invocations go through JWT scope checks and policy PEPs; sensitive obligations (e.g., requireBio) enforced by UI with suspend/resume patterns.

### Workflows: Control Flow, Loops, Suspend/Resume, Streaming

packages/agent/src/workflows.ts:
```ts
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const planTasks = createStep({
  id: "plan-tasks",
  description: "Plan tasks for a high-level requirement",
  inputSchema: z.object({ requirement: z.string() }),
  outputSchema: z.object({ tasks: z.array(z.string()) }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("alfred");
    const res = await agent.generate([
      { role: "user", content: `Break down requirement into 3-5 concrete tasks:\n${inputData.requirement}` },
    ], { maxSteps: 1 });
    const tasks = res.text.split(/\n+/).map(s => s.replace(/^\s*[-*]\s*/, "")).filter(Boolean).slice(0, 5);
    return { tasks };
  },
});

const runTaskWithDroid = createStep({
  id: "run-task-with-droid",
  description: "Execute a task via Droid Exec with specified auto",
  inputSchema: z.object({
    task: z.string(),
    auto: z.enum(["read", "low", "medium", "high"]).default("low"),
    cw: z.string().optional(),
  }),
  outputSchema: z.object({
    outcome: z.string(),
    artifacts: z.array(z.object({ path: z.string(), kind: z.string() })).optional(),
  }),
  execute: async ({ inputData, mastra, writer }) => {
    const agent = mastra.getAgent("alfred");
    await writer?.write({ type: "progress", pct: 10, message: `Starting task: ${inputData.task}` });
    const res = await agent.callTool("droidExec", {
      prompt: inputData.task,
      auto: inputData.auto,
      out: "json",
      cw: inputData.cw,
    }, { writer });
    await writer?.write({ type: "progress", pct: 90, message: "Finalizing artifacts" });
    return { outcome: res?.result ?? "completed", artifacts: res?.artifacts ?? [] };
  },
});

export const plan = createWorkflow({
  id: "orchestrator",
  description: "Orchestrator that plans tasks and routes to Droids",
  inputSchema: z.object({ requirement: z.string(), auto: z.enum(["read","low","medium","high"]).default("low") }),
  outputSchema: z.object({ summary: z.string(), results: z.array(z.any()) }),
})
  .then(planTasks)
  .foreach(
    createWorkflow({
      id: "task-subflow",
      inputSchema: z.object({ task: z.string(), auto: z.enum(["read","low","medium","high"]) }),
      outputSchema: z.object({ outcome: z.any() }),
    })
      .then(runTaskWithDroid)
      .map(({ getStepResult }) => {
        const r = getStepResult(runTaskWithDroid);
        return { outcome: r };
      })
      .commit(),
    {
      concurrency: 2,
      mapInput: ({ getStepResult, inputData }) => {
        const tasks = getStepResult(planTasks)?.tasks ?? [];
        return tasks.map((t: string) => ({ task: t, auto: inputData.auto }));
      },
    }
  )
  .map(({ getStepResult }) => {
    const tasks = getStepResult(planTasks)?.tasks ?? [];
    return { summary: `Executed ${tasks.length} tasks via Droids.`, results: tasks };
  })
  .commit();

export const workflows = { plan };
```

### RAG: Chunk → Embed → Store → Retrieve → Re-rank

packages/agent/src/rag.ts:
```ts
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { MDocument } from "@mastra/rag";
import { insertDocument, insertChunk, querySimilar } from "@alfred/db/repository";

export async function ingestTextDocument(source: string, title: string | undefined, text: string) {
  const doc = MDocument.fromText(text);
  const chunks = await doc.chunk({ strategy: "recursive", maxSize: 512, overlap: 50 });
  const inserted = await insertDocument(source, title);
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: chunks.map((c) => c.text),
  });
  for (let i = 0; i < chunks.length; i++) {
    await insertChunk(inserted.id, chunks[i]!.text, i, embeddings[i]!);
  }
  return inserted.id;
}

export async function retrieve(query: string, topK = 5) {
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: [query],
  });
  const similar = await querySimilar(embeddings[0]!, topK);
  return similar.rows.map((r: any) => ({ id: r.id, text: r.content, score: Number(r.score) }));
}
```

### Streaming and Stream-to-Cache Handoff

Server-side pattern:
```ts
// Inside a tool or workflow step
execute: async ({ inputData, writer }) => {
  await writer?.write({ type: "progress", pct: 50, message: "Halfway" });
  const payload = { id: "123", title: "New Report", updated: Date.now() };
  await writer?.write({ type: "data-cache-handoff", key: ["reports", payload.id], value: payload });
  return payload;
}
```

Client-side:
```ts
import { useQueryClient } from "@tanstack/react-query";
function onChunk(chunk: any, qc: ReturnType<typeof useQueryClient>) {
  if (chunk?.type === "data-cache-handoff" && chunk.key && chunk.value) {
    qc.setQueryData(chunk.key, chunk.value);
  }
}
```

### Observability: AI Tracing + OTEL

- DefaultExporter persists traces for local visibility.
- Add OTEL exporters as environment-configured options (e.g., SigNoz, Langfuse, Braintrust, Mastra Cloud).
- Include `traceId` in tRPC procedure responses for correlation.

Beyond Laminar: System metrics, logs, and alerts
Laminar covers AI/LLM tracing. For full-stack visibility (24/7 home-lab on Proxmox), add:
- Metrics: Prometheus scrapes app and infra metrics
  - App (TanStack Start server): /api/metrics (Prometheus format)
  - Containers: cAdvisor
  - Postgres: postgres_exporter
  - Redis: redis_exporter
  - Reverse proxy: Caddy Prometheus metrics
  - Blackbox: probe /healthz and app URLs
  - Proxmox: prometheus-pve-exporter from the PVE host
  - OTEL collector: pipeline health metrics
- Logs: Loki (+ Promtail) collects structured logs from Node (stdout) and containers
- Dashboards/alerts: Grafana + Alertmanager

App instrumentation (Node, Prometheus metrics)
- Create a Prometheus registry and basic counters/histograms for tRPC, workflows, and Droids.

packages/api/src/metrics.ts (example)
```ts
import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const trpcRequestsTotal = new client.Counter({
  name: "trpc_requests_total",
  help: "Total number of tRPC requests",
  labelNames: ["router", "procedure", "method"],
});
export const trpcRequestDuration = new client.Histogram({
  name: "trpc_request_duration_seconds",
  help: "tRPC request duration (seconds)",
  labelNames: ["router", "procedure", "method"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
export const trpcErrorsTotal = new client.Counter({
  name: "trpc_errors_total",
  help: "Total number of tRPC errors",
  labelNames: ["router", "procedure", "code"],
});
export const workflowRunsTotal = new client.Counter({
  name: "workflow_runs_total",
  help: "Orchestrator workflow runs",
  labelNames: ["workflow", "status"], // started|completed|failed|suspended|resumed
});
export const droidExecRunsTotal = new client.Counter({
  name: "droid_exec_runs_total",
  help: "Droid exec runs and exit codes",
  labelNames: ["auto", "exit_code"],
});

register.registerMetric(trpcRequestsTotal);
register.registerMetric(trpcRequestDuration);
register.registerMetric(trpcErrorsTotal);
register.registerMetric(workflowRunsTotal);
register.registerMetric(droidExecRunsTotal);
```

Expose metrics at `/api/metrics` in TanStack Start (server route)
apps/web/src/routes/api/metrics.ts:
Health and readiness endpoints:

- `/healthz`: returns `{ ok: true, ts }` and increments `health_checks_total{target="app",status}`.
- `/healthz/deps`: runs `SELECT 1` against Postgres and `PING` against Redis (when configured); increments `health_checks_total{target="deps",status}` and emits 500 on failure with `{ ok: false, error }` payload.

```ts
import { metricsContentType, getMetricsSnapshot } from "@alfred/api/metrics";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/metrics")({
  server: {
    handlers: {
      GET: async () => {
        const body = await getMetricsSnapshot();
        return new Response(body, {
          headers: { "content-type": metricsContentType },
        });
      },
    },
  },
});
```

tRPC middleware instrumentation (record requests/durations/errors)
packages/api/src/trpc.ts (snippet):
```ts
import { register, trpcRequestsTotal, trpcRequestDuration, trpcErrorsTotal } from "./metrics";

export const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

const metricsMiddleware = t.middleware(async ({ path, type, next }) => {
  const [router, procedure = ""] = path.split(".");
  const endTimer = trpcRequestDuration.startTimer({ router, procedure, method: type });
  trpcRequestsTotal.inc({ router, procedure, method: type });
  try {
    const res = await next();
    endTimer();
    return res;
  } catch (err: any) {
    trpcErrorsTotal.inc({ router, procedure, code: String(err?.code ?? "ERR") });
    endTimer();
    throw err;
  }
});

export const authedProcedure = t.procedure
  .use(metricsMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.session?.user) throw new Error("unauthorized");
    return next({ ctx });
  });
```

Current Prometheus series include:
- `trpc_requests_total`, `trpc_request_errors_total`, `trpc_request_duration_seconds`
- `health_checks_total{target,status}` for `/healthz` and `/healthz/deps`
- `policy_decisions_total{action,decision}` and `policy_obligations_total{action,obligation}` for PDP outcomes
- `pdp_cache_hits_total{result}` to observe policy cache hit/miss ratios
- `droid_exec_runs_total{auto,exit_code}` and `droid_exec_duration_seconds{auto}` for secure droid executions

Droid exec instrumentation (count runs and exit codes)
packages/agent/src/tools/droid.ts (snippet):
```ts
import { droidExecRunsTotal } from "@alfred/api/metrics";

// ... inside child.on("close", (code) => { ... })
droidExecRunsTotal.inc({ auto: args.auto, exit_code: String(code ?? 0) });
```

Health endpoints and blackbox
- Add /healthz returning 200 for app liveness; optionally add /healthz/deps to check DB and Redis
- Probe these endpoints with blackbox_exporter

Monitoring stack deployment (on alfred-core VM)
- Docker Compose (docker/monitoring) to run:
  - prometheus, alertmanager, grafana, loki, promtail, cadvisor, blackbox-exporter
- Exporters to run:
  - node_exporter (inside alfred-core VM)
  - postgres_exporter, redis_exporter (as containers)
  - Caddy metrics enabled
  - prometheus-pve-exporter on the Proxmox host (scraped over LAN/VPN)

Example alert policies (Alertmanager)
- Host/VM: CPU > 85% (10m), Memory > 90% (10m), Disk free < 15%
- App/API: 5xx error rate > 2% (5m); /healthz probing failures
- Workflows/Droids: elevated non-zero droid_exec exit rate; long suspend without resume
- DB/Cache: Postgres connection saturation > 80%; Redis evictions > 0
- Backups: last pg_dump > 26h; last vzdump > 26h

Security and access
- Bind /api/metrics to LAN or protect via reverse proxy auth
- Grafana/Alertmanager require credentials; keep dashboards on LAN/VPN
- Keep secrets out of logs; continue using Mastra SensitiveDataFilter for AI spans

---

## Orchestrator and Droids Integration

ALFRED orchestrates high-level goals into actionable tasks and routes focused work to Droids (Factory’s headless CLI) and other agents/tools. This mirrors the original hierarchy: ALFRED (assistant) → ORCHESTRATOR (projects) → AGENTS LAYER (Droids primary).

### Droid Exec Tool (Headless CLI Runner)

#### Sandbox environment controls

Environment variables shape the local sandbox:

- `ORCH_ALLOW_CWD_PREFIXES` — `path.delimiter` separated absolute paths that the orchestrator may use as working directories. Each candidate is realpathed and must live beneath one of the prefixes (symlinks cannot escape).
- `DROID_BIN` — absolute path to the droid CLI. If unset, the runner resolves an executable from the host `PATH` at runtime and verifies `X_OK` permissions. User-provided `PATH` overrides from requests are ignored.
- `FACTORY_API_KEY` — credential forwarded to the droid CLI for Factory backend access.

Safety defaults:
- Working directories are validated with `realpath` + ancestry checks (`path.relative`) before launch.
- `input.env` overrides are restricted to keys prefixed with `DROID_`; `PATH` and other critical variables are locked down.
- Outputs are capped (5 MiB combined stdout) and the process is killed on timeout or cancellation.
- All invocations require a scoped tool token (`droid.exec`), and medium/high autonomy additionally require a fresh biometric elevation (`mfa=passkey`, `elevated=true`).

packages/agent/src/tools/droid.ts:
```ts
import { z } from "zod";
import { spawn } from "node:child_process";
import { requireToolScopes } from "@alfred/auth/token";

export const droidExecInput = z.object({
  prompt: z.string(),
  out: z.enum(["text","json","debug"]).default("text"),
  auto: z.enum(["read","low","medium","high"]).default("read"),
  model: z.string().optional(), // e.g., "gpt-5-codex"
  cw: z.string().optional(),
  artifacts: z.array(z.object({ file: z.string() })).optional(),
  authz: z.string().optional(), // Bearer JWT for scope validation
});

export async function execDroidCLI(
  args: {
    prompt: string;
    out: "text" | "json" | "debug";
    auto: "read" | "low" | "medium" | "high";
    model?: string;
    cw?: string;
  },
  onChunk?: (c: any) => void,
  opts?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<{ result: string; artifacts?: { path: string; kind: string }[] }> {
  const flags: string[] = ["exec"];
  flags.push("-o", args.out);
  if (args.model) flags.push("-m", args.model);
  if (args.auto === "low") flags.push("--auto", "low");
  if (args.auto === "medium") flags.push("--auto", "medium");
  if (args.auto === "high") flags.push("--auto", "high");
  flags.push(args.prompt);

  return await new Promise((resolve, reject) => {
    const child = spawn("droid", flags, {
      cw: args.cw || process.cw(),
      env: { ...process.env, FACTORY_API_KEY: process.env.FACTORY_API_KEY || "" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const killTimer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      reject(new Error("droid exec timed out"));
    }, opts?.timeoutMs ?? 30 * 60 * 1000);

    if (opts?.signal) {
      opts.signal.addEventListener("abort", () => {
        try { child.kill("SIGTERM"); } catch {}
      }, { once: true });
    }

    let stdout = "";
    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      if (args.out === "debug") {
        // debug streams are JSON lines
        text.split(/\n+/).forEach((ln) => {
          try { onChunk?.(JSON.parse(ln)); } catch {}
        });
      } else {
        onChunk?.({ type: "stdout", text });
      }
    });
    child.stderr.on("data", (data) => onChunk?.({ type: "stderr", text: data.toString() }));

    child.on("error", (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      if (code !== 0) return reject(new Error(`droid exec exited with code ${code}`));
      resolve({ result: stdout.trim() });
    });
  });
}

export const toolDroidExec = {
  name: "droidExec",
  description: "Run a one-shot droid exec task (non-interactive)",
  inputSchema: droidExecInput,
  outputSchema: z.object({
    result: z.string(),
    artifacts: z.array(z.object({ path: z.string(), kind: z.string() })).optional(),
  }),
  execute: async ({ input, writer }: any) => {
    await requireToolScopes(input.authz, ["droid.exec"]);
    await writer?.write({ type: "progress", pct: 5, message: "Spawning droid exec" });
    const res = await execDroidCLI({
      prompt: input.prompt,
      out: input.out,
      auto: input.auto,
      model: input.model,
      cw: input.cw,
    }, (chunk) => writer?.write({ type: "droid", chunk }), { timeoutMs: 30 * 60 * 1000 });
    await writer?.write({ type: "progress", pct: 95, message: "Droid task complete" });
    return { result: res.result, artifacts: [] };
  },
};
```

Notes:
- Secure-by-default: require `droid.exec` scope via JWT.
- Autonomy flags map to Droid Exec levels (read-only default).
- Streaming: forward stdout/debug lines as Mastra events for live UI.

### Custom Droids (Subagents) Loader

Expose project and personal droids (.factory/droids/*.md) for selection and invocation:

packages/agent/src/tools/droid.ts:
```ts
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";

export const toolListDroids = {
  name: "listDroids",
  description: "List available custom Droids (project and personal)",
  inputSchema: z.object({}),
  outputSchema: z.object({
    droids: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      location: z.enum(["project","personal"]),
      model: z.string().optional(),
      tools: z.union([z.string(), z.array(z.string())]).optional(),
    })),
  }),
  execute: async () => {
    const projectDir = path.join(process.cw(), ".factory", "droids");
    const personalDir = path.join(os.homedir(), ".factory", "droids");
    const scan = (dir: string, location: "project" | "personal") => {
      if (!dir || !fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter(f => f.endsWith(".md")).map((f) => {
        const full = path.join(dir, f);
        const txt = fs.readFileSync(full, "utf8");
        const parsed = matter(txt);
        const fm: any = parsed.data || {};
        const name = typeof fm.name === "string" ? fm.name : f.replace(/\.md$/, "");
        const description = typeof fm.description === "string" ? fm.description : undefined;
        const model = typeof fm.model === "string" ? fm.model : undefined;
        const tools = fm.tools ?? undefined;
        return { name, description, model, tools, location };
      });
    };
    const droids = [...scan(projectDir, "project"), ...scan(personalDir, "personal")];
    return { droids };
  },
};
```

Use `toolListDroids` to power UI menus and Orchestrator decisions.

### Task Routing and Autonomy Policy

- Policy map: role → allowed auto and scopes.
- Default: `read` auto for untrusted contexts; escalate to `low/medium/high` only with biometric confirmation and scope grant.
- Orchestrator uses `suspend()` to pause before high-risk actions; the UI prompts for biometric approval and resumes with a signed scope token.

Example policy (concept):
- viewer: read only
- developer: read, low, medium (requires droid.exec)
- admin: read, low, medium, high (requires droid.exec and droid.admin)

### CI/CD: Automated Code Review with Droid Exec

Adopt a GitHub Actions workflow to run Droid Exec on PRs and post inline comments. See "Automated Code Review" recipe from Droids docs. Integrate with repository secrets:
- FACTORY_API_KEY
- GITHUB_TOKEN

This provides continuous feedback and complements Orchestrator-led task execution.

### Linear Integration (Agent Sessions, Webhooks, OAuth)

Goal: Make Alfred a first-class Linear agent for end-to-end project management while preserving the Jarvis-like hierarchy:
- Alfred (assistant) monitors and intervenes.
- Orchestrator translates requirements into Linear issues/projects, routes execution to Droids.
- Agents layer integrates Factory Droid Exec (primary) and other LLMs as needed.

Key capabilities:
- Install Alfred as a Linear app (actor=app) with mention/assign support.
- Receive AgentSession webhooks for delegation or mentions and start/continue a session.
- Emit Agent Activities (thought/action/elicitation/response/error) in near-real-time.
- Manage issues/projects, move statuses to started, set Alfred as delegate, and write comments.
- Keep a durable mapping between Linear workspace/session and Alfred runs via the Graph Memory and a lightweight Linear installations table.

Setup steps
1) Create a Linear OAuth application
- Enable webhooks and select Agent session events; optionally Inbox notifications and Permission changes.
- Use actor=app for installation scope. Request scopes:
  - read, write, issues:create, comments:create
  - app:assignable, app:mentionable
  - Optional per-workspace needs: customer:read/write, initiative:read/write
- Configure redirect URI to your app (e.g., https://app.example.com/oauth/linear/callback).

2) Database additions: store workspace installation
packages/db/src/migrations/0002_linear.sql:
```sql
CREATE TABLE IF NOT EXISTS linear_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_client_id text NOT NULL,
  app_user_id text NOT NULL,
  workspace_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  scope text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS linear_installations_workspace_idx ON linear_installations(workspace_id);
CREATE INDEX IF NOT EXISTS linear_installations_oauth_idx ON linear_installations(oauth_client_id);
```

packages/db/src/schema/linear.ts (append to schema.ts in real code):
```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const linearInstallations = pgTable("linear_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  oauthClient: text("oauth_client_id").notNull(),
  appUser: text("app_user_id").notNull(),
  space: text("workspace_id").notNull(),
  token: text("access_token").notNull(),
  refresh: text("refresh_token"),
  scope: text("scope").notNull(),
  expires: timestamp("expires_at", { withTimezone: true }),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

packages/db/src/repo/linear.ts (helpers):
```ts
import { db } from "./client";
import { linearInstallations } from "./schema";
import { eq, and } from "drizzle-orm";

export async function upsertLinearInstallation(input: {
  oauthClient: string;
  appUser: string;
  space: string;
  token: string;
  refresh?: string | null;
  scope: string;
  expires?: Date | null;
}) {
  const { oauthClient, appUser, space, token, refresh, scope, expires } = input;
  const now = new Date();
  // Use ON CONFLICT via raw SQL for simplicity in blueprint
  await db.execute(`
    INSERT INTO linear_installations (oauth_client_id, app_user_id, workspace_id, access_token, refresh_token, scope, expires_at, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
    ON CONFLICT (workspace_id) DO UPDATE
      SET access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          scope = EXCLUDED.scope,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at
  `, [oauthClient, appUser, space, token, refresh ?? null, scope, expires ?? null, now]);
}

export async function getLinearInstallationByWorkspace(space: string) {
  const rows = await db.select().from(linearInstallations).where(eq(linearInstallations.space, space)).limit(1);
  return rows[0] || null;
}

export async function getLinearInstallationByOAuthClientId(oauthClient: string) {
  const rows = await db.select().from(linearInstallations).where(eq(linearInstallations.oauthClient, oauthClient)).limit(1);
  return rows[0] || null;
}
```

3) OAuth flow and tRPC endpoints
Add a Linear router to compute authorize URL and exchange code for tokens.

packages/api/src/rpc/linear.ts:
```ts
import { router, authedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { LinearClient } from "@linear/sdk";
import crypto from "node:crypto";
import { upsertLinearInstallation } from "@alfred/db/repo/linear";

const LINEAR_AUTH_BASE = "https://linear.app/oauth/authorize";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";

function scopes() {
  // Minimal set; adjust per workspace needs
  return ["read","write","issues:create","comments:create","app:assignable","app:mentionable"].join(",");
}

export const linearRouter = router({
  getAuthorizeUrl: authedProcedure
    .input(z.object({ uri: z.string().url() }))
    .query(async ({ input, ctx }) => {
      const state = crypto.randomBytes(16).toString("hex");
      // Persist state to the user's session/kv and validate in oauthCallback
      const url = new URL(LINEAR_AUTH_BASE);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", process.env.LINEAR_CLIENT_ID!);
      url.searchParams.set("redirect_uri", input.uri);
      url.searchParams.set("scope", scopes());
      url.searchParams.set("actor", "app");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "consent");
      return { url: url.toString(), state };
    }),

  oauthCallback: publicProcedure
    .input(z.object({ code: z.string(), uri: z.string().url(), state: z.string().optional() }))
    .mutation(async ({ input }) => {
      // TODO: Validate input.state against server-side session/kv

      const params = new URLSearchParams();
      params.set("code", input.code);
      params.set("redirect_uri", input.uri);
      params.set("client_id", process.env.LINEAR_CLIENT_ID!);
      params.set("client_secret", process.env.LINEAR_CLIENT_SECRET!);
      params.set("grant_type", "authorization_code");

      const resp = await fetch(LINEAR_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!resp.ok) throw new Error(`linear_token_exchange_failed:${resp.status}`);
      const data = await resp.json() as {
        access_token: string; token_type: string; expires_in: number; scope: string; refresh_token?: string;
      };

      // Identify the workspace (organization) and app user
      const lc = new LinearClient({ token: data.access_token });
      const viewer = await lc.viewer;
      const organization = await lc.organization;
      const space = organization.id;

      await upsertLinearInstallation({
        oauthClient: process.env.LINEAR_CLIENT_ID!,
        appUser: viewer.id,
        space,
        token: data.access_token,
        refresh: data.refresh_token ?? null,
        scope: data.scope,
        expires: new Date(Date.now() + (data.expires_in * 1000)),
      });

      return { ok: true, space };
    }),
});
```

4) Webhook ingestion (HTTP route) and session lifecycle
Add a typed webhook handler that verifies signatures and acknowledges within 5s, then kicks off work in background.

apps/web/src/routes/api/linear/webhook.ts:
```ts
import { LinearWebhookClient, LINEAR_WEBHOOK_SIGNATURE_HEADER, LINEAR_WEBHOOK_TS_FIELD } from "@linear/sdk/webhooks";
import { mastra } from "@alfred/agent";
import { LinearClient } from "@linear/sdk";
import { getLinearInstallationByOAuthClientId } from "@alfred/db/repo/linear";

// Example TanStack Start handler-style; adapt to your server runtime
export async function POST(req: Request) {
  const webhookClient = new LinearWebhookClient(process.env.LINEAR_WEBHOOK_SECRET!);

  const raw = await req.text();
  const sig = req.headers.get(LINEAR_WEBHOOK_SIGNATURE_HEADER) || "";
  const ts = req.headers.get(LINEAR_WEBHOOK_TS_FIELD) || "";

  try {
    webhookClient.verify(Buffer.from(raw), sig, ts);
  } catch (e) {
    return new Response("invalid signature", { status: 401 });
  }

  // NOTE: For production, enqueue durable background work (e.g., Inngest or a DB-backed queue) instead of relying on immediate background execution.
  const handler = webhookClient.createHandler();
  setImmediate(async () => {
    handler.on("AgentSessionEvent", async (payload: any) => {
      const { action, agentSession, oauthClient } = payload;
      const install = await getLinearInstallationByOAuthClientId(oauthClient);
      if (!install) return;
      const lc = new LinearClient({ token: install.token });

      // Always acknowledge start within 10s
      const acknowledge = async (text: string) => {
        await lc.createAgentActivity({
          agentSessionId: agentSession.id,
          content: { type: "thought", body: text },
          ephemeral: true,
        });
      };

      if (action === "created") {
        await acknowledge("Alfred has started planning your task and preparing execution.");
        // Best practices: set delegate + move to started
        try {
          const issueId = agentSession.issue?.id;
          if (issueId) {
            const issue = await lc.issue(issueId);
            const team = await issue.team;
            const states = await team.states();
            const started = states.nodes.find(s => s.type === "started") || states.nodes[0];
            if (started?.id) await issue.update({ stateId: started.id });
            // Set Alfred as delegate if not set
            if (!issue.delegate) {
              await issue.update({ delegate: install.appUser });
            }
          }
        } catch {}

        // Kick off orchestrator workflow in background
        const wf = mastra.getWorkflow("plan");
        const run = await wf.createRunAsync();
        const requirement = agentSession.comment?.body || agentSession.issue?.title || "Plan and execute delegated task";
        (async () => {
          try {
            const result = await run.start({ inputData: { requirement, auto: "low" } });
            await lc.createAgentActivity({
              agentSessionId: agentSession.id,
              content: { type: "response", body: `Completed initial execution plan.\n\nSummary: ${result.summary}` },
            });
          } catch (err: any) {
            await lc.createAgentActivity({
              agentSessionId: agentSession.id,
              content: { type: "error", body: `Workflow failed: ${err?.message || err}` },
            });
          }
        })();
      }

      if (action === "prompted") {
        await acknowledge("Received your follow-up. Continuing...");
        // Continue agent chat if needed (optional)
        const agent = mastra.getAgent("alfred");
        const res = await agent.generate([
          { role: "user", content: agentSession.agentActivity?.content?.body || "Continue" },
        ]);
        await lc.createAgentActivity({
          agentSessionId: agentSession.id,
          content: { type: "response", body: res.text || "Updated." },
        });
      }
    });

    // Dispatch the event
    handler.dispatch(raw);
  });

  return new Response("ok", { status: 200 });
}
```

5) Tickets Tool (Linear-backed, JWT-protected)
Expose a Mastra tool that safely creates or updates Linear issues with scope-checked JWT.

packages/agent/src/tools/ticket.ts:
```ts
import { z } from "zod";
import { requireToolScopes } from "@alfred/auth/token";
import { LinearClient } from "@linear/sdk";
import { getLinearInstallationByWorkspace } from "@alfred/db/repo/linear";

export const ticketsInput = z.object({
  space: z.string(),
  teamId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  issueId: z.string().optional(),
  authz: z.string().optional(), // Bearer token for scope validation
});

export const toolTickets = {
  name: "tickets",
  description: "Create or update Linear issues (JWT-protected)",
  inputSchema: ticketsInput,
  outputSchema: z.object({ id: z.string(), url: z.string().optional() }),
  execute: async ({ input }: any) => {
    await requireToolScopes(input.authz, ["tickets.write"]);
    const install = await getLinearInstallationByWorkspace(input.space);
    if (!install) throw new Error("linear_installation_missing");

    const lc = new LinearClient({ token: install.token });
    if (input.issueId) {
      const issue = await lc.issue(input.issueId);
      const payload = await issue.update({ title: input.title, description: input.description });
      return { id: input.issueId, url: (await lc.issue(input.issueId)).url };
    } else {
      // Create on first accessible team if none provided
      let teamId = input.teamId;
      if (!teamId) {
        const teams = await lc.teams();
        teamId = teams.nodes[0]?.id;
      }
      if (!teamId) throw new Error("no_team_accessible");
      const created = await lc.createIssue({ teamId, title: input.title, description: input.description });
      return { id: created.issue?.id!, url: created.issue?.url };
    }
  },
};
```

6) Best practices and UX mapping
- Respond with a thought activity within 10s of created events to avoid the "unresponsive" state.
- Move issues to "started" when work begins; set Alfred as delegate to clarify responsibility.
- Use response activities for completion; elicitation for questions; action for tool calls and results.
- Optionally set an external URL on the session to open Alfred’s run UI: use agentSessionUpdateExternalUrl.
- Persist Linear workspace/session → Alfred run/thread mapping with the Graph Memory tables (memory_nodes/edges).

---

## Auth Model

### End-user Auth (Better Auth + Passkeys)

Better Auth manages ALFRED’s user sessions. The Passkey plugin is enabled and, after each successful passkey sign-in, the server stamps a **bio-ticket** (120 s TTL) tied to the Better Auth session id. `packages/auth/src/biometric.ts` persists tickets in Redis when `REDIS_URL` is defined or falls back to an in-process cache; elevated tool tokens are rejected once the ticket expires. Native clients reuse the same auth instance via the Expo plugin.

Key integration points:

- `packages/auth/src/index.ts` wires the Drizzle adapter, passkey plugin, bio-ticket after-hook, Expo plugin, and `reactStartCookies()` for TanStack Start SSR.
- `apps/web/src/routes/api/auth/$.ts` exposes the Better Auth handler at `/api/auth/*`.
- `apps/web/src/lib/auth-client.ts` loads `passkeyClient()` so the browser flow can trigger WebAuthn challenges.

```ts
// packages/auth/src/index.ts (excerpt)
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { passkey } from "better-auth/plugins/passkey";
import { reactStartCookies } from "better-auth/react-start";
import { expo } from "@better-auth/expo";
import { db } from "@alfred/db";
import { setBiometricTicket } from "./biometric";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins,
  emailAndPassword: { enabled: true },
  plugins: [
    passkey({ rpID, rpName: "ALFRED", origin }),
    {
      id: "bio-ticket",
      hooks: {
        after: [
          {
            matcher: ctx => ctx.path === "/sign-in/passkey",
            handler: createAuthMiddleware(async ctx => {
              const session = ctx.context.newSession?.session ?? ctx.context.session?.session;
              const sessionId = session?.id ?? session?.token;
              if (sessionId) await setBiometricTicket(sessionId, 120);
            }),
          },
        ],
      },
    },
    expo(),
    reactStartCookies(),
  ],
});
```

Environment variables:

```
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
REDIS_URL=redis://127.0.0.1:6379 # optional shared bio-ticket cache
```

Web client (passkey-aware):

```ts
import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [passkeyClient()],
});
```

7) Server-side session retrieval
Anywhere on the server (e.g., routes, loaders, or API handlers), retrieve the session from request headers:
```ts
import { auth } from "@alfred/auth/auth";

const session = await auth.api.getSession({ headers: request.headers });
// session?.user is available when authenticated
```

8) Biometric gating with Passkeys (WebAuthn)
- Add a passkey from the client after user signs in:
```ts
const { data, error } = await authClient.passkey.addPasskey({
  name: "My Mac Touch ID",
  authenticatorAttachment: "platform",
});
```
- Sign in with a passkey:
```ts
await authClient.signIn.passkey({ autoFill: true });
```
- In Alfred, before performing a high-risk action, suspend the workflow and prompt users to authenticate with passkey. On success, resume and continue with elevated scopes (e.g., droid.exec medium/high or proxmox.power) by issuing the appropriate scoped tool token.

### Agent-to-Tool Auth (Ed25519 JWT, JWKS, Scopes)

Tool-facing calls rely on short-lived Ed25519 JWTs. Tokens default to a five-minute TTL and carry scopes plus optional elevation metadata (`elevated`, `mfa`, `roles`). Elevated tokens are issued only when a fresh bio-ticket exists.

Highlights:

- `packages/auth/src/token.ts` signs/verifies tokens and defends against replay via `cacheJTI` (Redis-backed when available).
- `packages/api/src/routers/token.ts` exposes two authed procedures:
  - `token.issue(scopes[], aud, ttlSec?)` → scoped, non-elevated token.
  - `token.elevate(...)` → calls `requireRecentBiometric`, sets `elevated=true`, `mfa="passkey"`.
- `apps/web/src/lib/token.ts` provides `getElevatedToolToken(scopes)` which triggers a passkey assertion before invoking `token.elevate`.
- `packages/auth/src/jwks.ts` exports the Ed25519 public key; `apps/web/src/routes/api/jwks.ts` serves it at `/api/jwks` for external verifiers.
- Token middleware and audits: the tRPC router wraps `token.issue` / `token.elevate` with `requirePolicy`, logging each decision via `policyRepo.createAuditLog` and incrementing `policy_decisions_total{action,decision}`.
- Tool boundary guard: downstream tools call `requireToolScopesAndPolicy(authz, requiredScopes, { action, resource, context })`, which verifies the Bearer scopes, runs the PDP, and enforces biometric elevation (`auto` ∈ {`medium`, `high`} requires `claims.elevated === true` and `claims.mfa === "passkey"`).

```ts
// packages/api/src/routers/token.ts (excerpt)
export const tokenRouter = router({
  issue: authedProcedure
    .input(z.object({ scopes: scopesSchema, aud: z.string().optional(), ttlSec: ttlSchema }))
    .mutation(async ({ ctx, input }) => {
      const token = await issueAccessToken(ctx.session.user.id, input.scopes, input.aud ?? defaultAudience, {
        ttlSec: input.ttlSec,
        elevated: false,
        mfa: "none",
      });
      return { token };
    }),
  elevate: authedProcedure
    .input(z.object({ scopes: scopesSchema, aud: z.string().optional(), ttlSec: ttlSchema }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = ctx.session.session?.id ?? ctx.session.session?.token;
      if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireRecentBiometric(sessionId);
      const token = await issueAccessToken(ctx.session.user.id, input.scopes, input.aud ?? defaultAudience, {
        ttlSec: input.ttlSec,
        elevated: true,
        mfa: "passkey",
      });
      return { token };
    }),
});
```

Environment variables:

```
TOOL_AUDIENCE=alfred:tools
AGENT_ISSUER=alfred
AGENT_JWK_KID=agent-ed25519
AGENT_ED25519_PRIVATE=-----BEGIN PRIVATE KEY-----...
AGENT_ED25519_PUBLIC_PEM=-----BEGIN PUBLIC KEY-----...
REDIS_URL=redis://127.0.0.1:6379 # optional for bio-ticket/JTI cache
```

Tool entry points must validate required scopes and, for `auto` modes of `medium` or `high`, enforce `claims.elevated === true` and `claims.mfa === "passkey"` before performing risky operations. Background workers can verify tokens using the JWKS endpoint.

---

## Policy & Authorization (RBAC/ABAC + Obligations)

Alfred enforces access control and safety through a centralized, policy- and rules-based system that complements existing auth layers:
- End-user auth via Better Auth (session cookies) for the UI/tRPC.
- Agent-to-tool auth via short-lived JWTs (Ed25519) with scopes and claims for protected tools.
- A lightweight, in-process Policy Decision Point (PDP) evaluates RBAC+ABAC rules and returns decisions and obligations (e.g., requireBio, limitAuto, requireManual).
- Policy Enforcement Points (PEPs) exist at tRPC procedures, Mastra tools, and workflows. PEPs must enforce PDP obligations (e.g., suspend/resume for biometric elevation).

Key goals
- Single-user friendly defaults (Jack = owner) with strong safety.
- No external policy server; policies are YAML/JSON files read in-process with hot reload (optional).
- Explicit approvals and biometric elevation for high-risk actions (e.g., proxmox.admin, deploy.production, droid.exec medium/high).
- Durable audit logs for every decision and action; simple approvals queue for manual gates.

### Policy model: RBAC + ABAC + obligations

Subjects
- UI user (Jack) via Better Auth (roles: owner).
- Agents ("alfred" Orchestrator, "assistant" Personal Assistant) via JWT tokens embedding roles and claims (e.g., elevated, mfa, maxAuto).

Resources and actions
- Tools: droidExec, proxmoxLxc, docker, router, tickets, web.fetch, repo.git ops.
- Data: deployments, plans, personalization tables.
- Actions: read|write, power, admin, deploy (preview|promote|remove), droid.exec (auto-aware).

Autonomy and obligations
- Autonomy: read|low|medium|high.
- Obligations (PDP → PEP): requireBio, requireManual, limitAuto, maxTTL.

### Policy configuration (YAML)

Repo file: config/policy.yaml

```yaml
roles:
  owner:
    scopes:
      - assistant.read
      - assistant.write
      - assistant.escalate
      - web.read
      - droid.exec
      - token.issue
      - token.elevate
  user:
    scopes:
      - assistant.read
      - assistant.write
      - assistant.escalate
      - web.read

rules:
  - id: token-issue-owner
    actions: ["token.issue"]
    roles: ["owner"]

  - id: token-elevate-owner
    actions: ["token.elevate"]
    roles: ["owner"]
    conditions:
      - field: "mfa"
        equals: "passkey"
      - field: "elevated"
        equals: true

  - id: droid-exec-owner
    actions: ["droid.exec"]
    roles: ["owner"]

  - id: droid-exec-requires-biometric
    actions: ["droid.exec"]
    roles: ["owner"]
    conditions:
      - field: "auto"
        in: ["medium", "high"]
    obligations: ["requireBio"]
```

Notes
- RBAC: roles (e.g., owner vs user) map to scopes; elevated actions such as `droid.exec` and token issuance live on the owner role.
- ABAC: resource attributes and request context (auto, drive_mode, mfa, elevated) drive conditional logic and obligations.
- Obligations (e.g., `requireBio`) are surfaced to PEPs; callers must suspend/resume or otherwise enforce them before continuing.

### Policy Decision Point (PDP)

Implementation highlights:

- **Loader** (`packages/policy/src/load.ts`): parses `config/policy.yaml` via YAML + Zod, memoises by file mtime, and normalises scopes/obligations.
- **Matcher** (`packages/policy/src/rule.ts`): applies action wildcards, role filters, resource kind/id matches, and ABAC conditions against `context.*` values.
- **Evaluator** (`packages/policy/src/pdp.ts`): merges role/subject scopes, applies deny/allow precedence, aggregates obligations, and caches decisions for ~30 s keyed by roles|action|resource|context.
- **Decision combiner** (`packages/policy/src/decide.ts`): merges multiple decisions (deny wins, obligations union, reasons concatenated) for multi-step workflows.
- **Observability**: each evaluation increments `policy_decisions_total{action,decision}` and writes an `audit_logs` record via `policyRepo.createAuditLog`.

Inputs include subject (id, roles, optional scopes), action string, resource `{ kind, id?, attrs? }`, and contextual metadata (auto level, drive_mode, mfa, elevated, ip, etc.). The PDP returns `{ allow, obligations[], reason?, ruleIds? }`.

Follow-ups:
- Extend PEP coverage to additional routers (deploy, home, proxmox) and surface obligation-specific metrics (e.g., `policy_obligations_total`).
- Replace the minimal Node-based droid runner with Mastra workflows and richer tooling once orchestrator scaffolding lands.

### Agent-to-tool JWT (claims & elevation)

- Tokens signed with Ed25519 (short-lived ≤ 5m) include:
  - scope (space-separated), roles (array), mfa (e.g., "passkey"), elevated (bool), maxAuto, jti (unique).
- Elevation for high-risk actions:
  - UI prompts biometric (Better Auth passkey).
  - tRPC endpoint issues elevated token (e.g., droid.exec medium/high, proxmox.admin), TTL ≤ 5m, sets claims { elevated: true, mfa: "passkey" }.
  - Replay defense via Redis-backed jti store; single-node fallback in memory.

### Database: Audit & approvals

Add migrations (append to Data Layer tooling):

packages/db/src/migrations/0006_policy_audit.sql
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz DEFAULT now(),
  subject_id text NOT NULL,
  subject_role text,
  action text NOT NULL,
  resource_kind text,
  resource_id text,
  context jsonb,
  decision text NOT NULL,
  obligations jsonb,
  reason text,
  trace_id text
);
CREATE INDEX IF NOT EXISTS audit_logs_ts_idx ON audit_logs(ts DESC);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  requester_id text NOT NULL,
  approver_id text,
  status text NOT NULL DEFAULT 'pending',
  scope text,
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals(status);
```

Drizzle schema (append to schema.ts)
```ts
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow(),
  subjectId: text("subject_id").notNull(),
  subjectRole: text("subject_role"),
  action: text("action").notNull(),
  resourceKind: text("resource_kind"),
  resourceId: text("resource_id"),
  context: jsonb("context"),
  decision: text("decision").notNull(),
  obligations: jsonb("obligations"),
  reason: text("reason"),
  traceId: text("trace_id"),
});
export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: text("request_id").notNull(),
  requesterId: text("requester_id").notNull(),
  approverId: text("approver_id"),
  status: text("status").notNull().default("pending"),
  scope: text("scope"),
  payload: jsonb("payload"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

Repository helpers (packages/db/src/repo/policy.ts)
- insertAuditLog({ subjectId, action, resource, context, decision, obligations, reason, traceId })
- createApproval({ requestId, requesterId, scope, payload })
- updateApproval({ id, status, approverId })

### tRPC PEP: route-level policy enforcement

Add a lightweight middleware wrapper to evaluate policy and record audits.

```ts
// packages/api/src/policy.ts
import { t } from "./trpc";
import { getPDP } from "@alfred/auth/policy";
import { insertAuditLog } from "@alfred/db/repo/policy";

export function requirePolicy(action: string, mapResource?: (input:any, ctx:any)=>{ kind:string; id?:string; attrs?:any }) {
  return t.middleware(async ({ input, ctx, next, path }) => {
    const pdp = getPDP();
    const subject = { id: ctx.session?.user?.id ?? "anon", roles: ctx.session?.user?.roles ?? ["owner"] };
    const resource = mapResource ? mapResource(input, ctx) : { kind: "route", id: path };
    const context = {
      time: new Date().toISOString(),
      driveMode: ctx.runtimeContext.get("drive_mode") ?? false,
      ip: ctx.ip ?? "unknown",
    };
    const decision = await pdp.evaluate({ subject, action, resource, context });
    await insertAuditLog({
      subjectId: subject.id,
      subjectRole: subject.roles.join(","),
      action,
      resource: resource.kind,
      resourceId: resource.id ?? null,
      context,
      decision: decision.allow ? "allow" : "deny",
      obligations: decision.obligations ?? [],
      reason: decision.reason ?? null,
      traceId: ctx.traceId ?? null,
    });
    if (!decision.allow) throw new Error("forbidden");
    return next();
  });
}
```

Example usage in routers
```ts
// packages/api/src/rpc/deploy.ts
createPreview: authedProcedure
  .use(requirePolicy("deploy.preview", (input, ctx) => ({ kind: "deploy", id: input.app, attrs: { env: "preview" } })))
  .input(/* zod */)
  .mutation(/* ... */);
promote: authedProcedure
  .use(requirePolicy("deploy.promote", (input, ctx) => ({ kind: "deploy", id: input.app, attrs: { env: "prod", domain: input.domain } })))
  .input(/* zod */)
  .mutation(/* ... */);
```

### Mastra Tool PEP: JWT scopes + PDP

Combine scope verification with policy evaluation for sensitive tools.

```ts
// packages/auth/src/token.ts
export async function requireToolScopesAndPolicy(authz: string | undefined, requiredScopes: string[], policyInput: { action: string; resource: {kind:string; id?:string; attrs?:any}; context?: any }) {
  if (!authz?.startsWith("Bearer ")) throw new Error("unauthorized");
  const token = authz.slice("Bearer ".length);
  const payload = await verifyAccessToken(token, process.env.TOOL_AUDIENCE!, requiredScopes);
  const subject = { id: String(payload.sub), roles: (payload.roles ?? []) as string[] };
  const pdp = getPDP();
  const decision = await pdp.evaluate({
    subject,
    action: policyInput.action,
    resource: policyInput.resource,
    context: { ...(policyInput.context ?? {}), mfa: payload.mfa, elevated: payload.elevated }
  });
  if (!decision.allow) throw new Error("forbidden");
  return decision;
}
```

Use in tools
```ts
// packages/agent/src/tools/droid.ts
const decision = await requireToolScopesAndPolicy(
  input.authz,
  ["droid.exec"],
  { action: "droid.exec", resource: { kind: "repo", id: input.cw ?? "unknown" }, context: { auto: input.auto } }
);
// enforce obligations and auto gating:
// - requireBio → payload.elevated === true && payload.mfa === "passkey"
// - if input.auto in ["medium","high"] → also require elevated+mfa before proceeding
```

### Workflow obligations: suspend/resume

High-risk obligations are enforced by suspending the workflow and resuming with an elevated token post-biometric approval.

```ts
// packages/agent/src/workflows/orchestrator.ts
const decision = await pdp.evaluate({
  subject: { id: ctx.runtimeContext.get("user"), roles: ["owner"] },
  action: "droid.exec",
  resource: { kind: "repo", id: inputData.cw ?? "unknown" },
  context: { auto: inputData.auto, driveMode: ctx.runtimeContext.get("drive_mode") }
});
if (!decision.allow) throw new Error("forbidden");
if (decision.obligations?.includes("requireBio")) {
  await writer?.write({ type: "suspend", reason: "biometric_required" });
  return "suspended";
}
// otherwise proceed with tool call using inputData.authz
```

### Observability and audits

- Every policy decision is persisted to audit_logs with traceId for correlation.
- Prometheus metrics:
  - `trpc_requests_total`, `trpc_request_errors_total`, `trpc_request_duration_seconds`
  - `health_checks_total{target,status}`
  - `policy_decisions_total{action,decision}`
  - `droid_exec_runs_total{auto,exit_code}`
- Laminar events for decision visibility:
```ts
Laminar.event({
  name: "policy.decision",
  attributes: { action, decision: decision.allow ? "allow" : "deny", obligations: (decision.obligations ?? []).join(",") }
});
```

Safety defaults
- Single-user mode: session.user.roles defaults to ["owner"].
- No autonomous widening of tool scopes or auto levels during self-improvement; proposals require approvals and biometric confirmation.

---

## tRPC Integration (packages/api)

packages/api/src/trpc.ts:
```ts
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@alfred/auth/auth";
import { RuntimeContext } from "@mastra/core/runtime-context";

// Build context from Better Auth session
export type TRPCContext = {
  session: any | null;
  headers: Headers;
  runtimeContext: RuntimeContext;
};

// Example createContext factory (adapt to your server adapter)
export async function createContext(opts: { req: Request }): Promise<TRPCContext> {
  const session = await auth.api.getSession({ headers: opts.req.headers }).catch(() => null);
  const runtimeContext = new RuntimeContext();
  if (session?.user?.id) {
    runtimeContext.set("user", session.user.id);
  }
  return { session, headers: opts.req.headers, runtimeContext };
}

export const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new Error("unauthorized");
  return next({ ctx });
});
```

### Agent Procedures (generate/stream)

packages/api/src/rpc/agent.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { mastra } from "@alfred/agent";
import { observable } from "@trpc/server/observable";

export const agentRouter = router({
  generate: authedProcedure
    .input(z.object({
      agent: z.enum(["alfred"]),
      messages: z.array(z.object({ role: z.string(), content: z.any() })).or(z.string()),
      memory: z.object({ resource: z.string(), thread: z.string() }).optional(),
      runtime: z.object({ userTier: z.enum(["free","pro","enterprise"]).optional() }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const agent = mastra.getAgent(input.agent);
      if (input.runtime?.userTier) ctx.runtimeContext.set("user-tier", input.runtime.userTier);
      const res = await agent.generate(input.messages as any, {
        memory: input.memory ? { resource: input.memory.resource, thread: input.memory.thread } : undefined,
        runtimeContext: ctx.runtimeContext,
        maxSteps: 3,
      });
      return { text: res.text, traceId: res.traceId };
    }),

  stream: authedProcedure
    .input(z.object({
      agent: z.enum(["alfred"]),
      messages: z.array(z.object({ role: z.string(), content: z.any() })).or(z.string()),
      memory: z.object({ resource: z.string(), thread: z.string() }).optional(),
    }))
    .subscription(({ input, ctx }) => {
      return observable<any>(async (emit) => {
        const agent = mastra.getAgent(input.agent);
        const stream = await agent.stream(input.messages as any, {
          runtimeContext: ctx.runtimeContext,
          onStepFinish: ({ text, toolCalls }) => emit.next({ type: "step-finish", text, toolCalls }),
          onFinish: ({ text, usage, finishReason, traceId }) => emit.next({ type: "finish", text, usage, finishReason, traceId }),
        });
        (async () => { for await (const chunk of stream) emit.next(chunk); emit.complete(); })()
          .catch((err) => emit.error(err));
        return () => {};
      });
    }),
});
```

### Workflow Procedures (start/stream)

packages/api/src/rpc/workflow.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { mastra } from "@alfred/agent";
import { observable } from "@trpc/server/observable";

export const workflowRouter = router({
  start: authedProcedure
    .input(z.object({ workflowId: z.enum(["plan"]), inputData: z.object({ requirement: z.string(), auto: z.enum(["read","low","medium","high"]).default("low") }) }))
    .mutation(async ({ input }) => {
      const wf = mastra.getWorkflow(input.workflowId);
      const run = await wf.createRunAsync();
      const res = await run.start({ inputData: input.inputData });
      // Include correlation metadata if available
      return { ...res, run: (run as any).id ?? undefined };
    }),

  stream: authedProcedure
    .input(z.object({ workflowId: z.enum(["plan"]), inputData: z.object({ requirement: z.string(), auto: z.enum(["read","low","medium","high"]).default("low") }) }))
    .subscription(({ input }) => {
      return observable<any>(async (emit) => {
        const wf = mastra.getWorkflow(input.workflowId);
        const run = await wf.createRunAsync();
        const stream = await run.streamVNext({ inputData: input.inputData });
        (async () => {
          for await (const chunk of stream) emit.next(chunk);
          const final = await run.getWorkflowState?.();
          emit.next({ type: "finish", state: final, run: (run as any).id ?? undefined });
          emit.complete();
        })().catch((err) => emit.error(err));
        return () => {};
      });
    }),
});
```

### Tool Procedures (JWT-protected: Droids/Proxmox)

packages/api/src/rpc/tool.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { mastra } from "@alfred/agent";
import { requireToolScopes } from "@alfred/auth/token";

export const toolRouter = router({
  proxmoxPower: authedProcedure
    .input(z.object({ vmId: z.string(), action: z.enum(["start","stop","reboot"]), authz: z.string().optional() }))
    .mutation(async ({ input }) => {
      await requireToolScopes(input.authz, ["proxmox.power"]);
      const tool = mastra.getAgent("alfred").tools?.proxmox;
      const res = await tool?.execute({ context: { action: input.action, vmId: input.vmId } });
      return res;
    }),
});
```

### Droids Procedures (run/stream/list)

- `packages/api/src/routers/droids.ts` exposes `droid.run` / `droid.stream`. Both wrap `requirePolicy("droid.exec")`, then call `requireToolScopesAndPolicy(authz, ["droid.exec"], { action: "droid.exec", resource: { kind: "repo", id: cwd }, context: { auto } })`.
- Medium/high autonomy demands elevated tool tokens (`claims.elevated === true` and `claims.mfa === "passkey"`), otherwise the router returns `FORBIDDEN` with `biometric_required`.
- The minimal implementation spawns a sandboxed Node subprocess (default `node -e ...`), streams stdout/stderr to subscribers, and records `droid_exec_runs_total{auto,exit_code}`.
- `list` remains TODO; replace with Mastra-backed enumerations once custom droids land.

### Assistant Procedures (generate/stream/escalate)

packages/api/src/rpc/assistant.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { mastra } from "@alfred/agent";
import { observable } from "@trpc/server/observable";

export const assistantRouter = router({
  generate: authedProcedure
    .input(z.object({
      agent: z.literal("assistant"),
      messages: z.array(z.object({ role: z.string(), content: z.any() })).or(z.string()),
      memory: z.object({ resource: z.string(), thread: z.string() }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const agent = mastra.getAgent("assistant");
      const res = await agent.generate(input.messages as any, {
        memory: input.memory ? { resource: input.memory.resource, thread: input.memory.thread } : undefined,
        runtimeContext: ctx.runtimeContext,
      });
      return { text: res.text, traceId: res.traceId };
    }),

  stream: authedProcedure
    .input(z.object({
      agent: z.literal("assistant"),
      messages: z.array(z.object({ role: z.string(), content: z.any() })).or(z.string()),
      memory: z.object({ resource: z.string(), thread: z.string() }).optional(),
    }))
    .subscription(({ input, ctx }) => {
      return observable<any>(async (emit) => {
        const agent = mastra.getAgent("assistant");
        const stream = await agent.stream(input.messages as any, {
          runtimeContext: ctx.runtimeContext,
          onFinish: ({ text, traceId }) => emit.next({ type: "finish", text, traceId }),
        });
        (async () => { for await (const chunk of stream) emit.next(chunk); emit.complete(); })()
          .catch((err) => emit.error(err));
        return () => {};
      });
    }),

  escalate: authedProcedure
    .input(z.object({ requirement: z.string().min(10), auto: z.enum(["read","low","medium","high"]).default("low"), authz: z.string().optional() }))
    .mutation(async ({ input }) => {
      const wf = mastra.getWorkflow("plan");
      const run = await wf.createRunAsync();
      await run.start({ inputData: { requirement: input.requirement, auto: input.auto } });
      return { run: (run as any).id, status: "started" };
    }),
});
```

### Reminders Procedures (create/list)

packages/api/src/rpc/reminders.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
// import { createReminder, listDueReminders } from "@alfred/db/repository.productivity";

export const remindersRouter = router({
  create: authedProcedure
    .input(z.object({ title: z.string(), dueAt: z.string().datetime(), channel: z.enum(["in-app","slack","voice"]).optional() }))
    .mutation(async ({ input, ctx }) => {
      // const r = await createReminder({ user: ctx.session.user.id, title: input.title, dueAt: new Date(input.dueAt), channel: input.channel ?? "in-app" });
      // return { id: r.id };
      return { ok: true }; // blueprint placeholder
    }),
  list: authedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      // return await listReminders(ctx.session.user.id);
      return { items: [] };
    }),
});
```

### Slack Procedures (OAuth/install/read inbox)

packages/api/src/rpc/slack.ts:
```ts
import { router, authedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
// import { upsertSlackInstall, getSlackInstallByWorkspace } from "@alfred/db/repository.productivity";

export const slackRouter = router({
  getAuthorizeUrl: authedProcedure
    .input(z.object({ uri: z.string().url() }))
    .query(async ({ input, ctx }) => {
      const state = "opaque-state"; // persist and validate in callback
      const url = new URL("https://slack.com/oauth/v2/authorize");
      url.searchParams.set("client_id", process.env.SLACK_CLIENT_ID!);
      url.searchParams.set("scope", "channels:history,groups:history,im:history,mpim:history");
      url.searchParams.set("user_scope", "");
      url.searchParams.set("redirect_uri", input.uri);
      url.searchParams.set("state", state);
      return { url: url.toString(), state };
    }),
  oauthCallback: publicProcedure
    .input(z.object({ code: z.string(), uri: z.string().url(), state: z.string().optional() }))
    .mutation(async ({ input }) => {
      // Exchange code for bot token and store installation
      return { ok: true };
    }),
  inbox: authedProcedure
    .input(z.object({ space: z.string(), sinceHours: z.number().int().min(1).max(168).default(24) }))
    .query(async ({ input, ctx }) => {
      // const install = await getSlackInstallByWorkspace(input.space);
      // fetch Slack API using install.token
      return { messages: [] };
    }),
});
```

### Home Procedures (control whitelisted entities)

packages/api/src/rpc/home.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
// import { requirePolicy } from "../policy";

export const homeRouter = router({
  control: authedProcedure
    // .use(requirePolicy("home.control", (input, ctx) => ({ kind: "home.entity", id: input.entityId })))
    .input(z.object({ action: z.enum(["turn_on","turn_off","toggle"]), entityId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Call toolHomeControl with JWT authz and policy enforcement
      return { ok: true };
    }),
});
```

### Voice Procedures (stt/tts)

packages/api/src/rpc/voice.ts:
```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";

export const voiceRouter = router({
  sttTranscribe: authedProcedure
    .input(z.object({ audioBase64: z.string(), lang: z.string().default("en") }))
    .mutation(async ({ input }) => {
      // placeholder STT; swap with Faster-Whisper or provider-based STT
      return { text: "[transcript]" };
    }),

  ttsSynthesize: authedProcedure
    .input(z.object({ text: z.string(), voice: z.string().default("en-US-male"), format: z.enum(["wav","ogg"]).default("ogg") }))
    .mutation(async ({ input }) => {
      // placeholder TTS; swap with Piper/Coqui/etc.
      return { audioBase64: "[base64-audio]" };
    }),
});
```

### Linear Procedures (oauth/install/webhooks)

packages/api/src/rpc/linear.ts:
```ts
import { router, authedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { LinearClient } from "@linear/sdk";
import crypto from "node:crypto";
import { upsertLinearInstallation } from "@alfred/db/repo/linear";

const LINEAR_AUTH_BASE = "https://linear.app/oauth/authorize";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";

export const linearRouter = router({
  getAuthorizeUrl: authedProcedure
    .input(z.object({ uri: z.string().url() }))
    .query(async ({ input }) => {
      const state = crypto.randomBytes(16).toString("hex");
      const url = new URL(LINEAR_AUTH_BASE);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", process.env.LINEAR_CLIENT_ID!);
      url.searchParams.set("redirect_uri", input.uri);
      url.searchParams.set("scope", ["read","write","issues:create","comments:create","app:assignable","app:mentionable"].join(","));
      url.searchParams.set("actor", "app");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "consent");
      return { url: url.toString(), state };
    }),

  oauthCallback: publicProcedure
    .input(z.object({ code: z.string(), uri: z.string().url(), state: z.string().optional() }))
    .mutation(async ({ input }) => {
      // TODO: Validate input.state against server-side session/kv

      const params = new URLSearchParams();
      params.set("code", input.code);
      params.set("redirect_uri", input.uri);
      params.set("client_id", process.env.LINEAR_CLIENT_ID!);
      params.set("client_secret", process.env.LINEAR_CLIENT_SECRET!);
      params.set("grant_type", "authorization_code");

      const resp = await fetch(LINEAR_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!resp.ok) throw new Error(`linear_token_exchange_failed:${resp.status}`);
      const data = await resp.json() as { access_token: string; expires_in: number; scope: string; refresh_token?: string };

      const lc = new LinearClient({ token: data.access_token });
      const viewer = await lc.viewer;
      const organization = await lc.organization;

      await upsertLinearInstallation({
        oauthClient: process.env.LINEAR_CLIENT_ID!,
        appUser: viewer.id,
        space: organization.id,
        token: data.access_token,
        refresh: data.refresh_token ?? null,
        scope: data.scope,
        expires: new Date(Date.now() + (data.expires_in * 1000)),
      });

      return { ok: true, space: organization.id };
    }),
});
```

Recommended UI flow:
- Client calls linear.getAuthorizeUrl → redirect user to Linear.
- Callback route in web app extracts code/state → calls linear.oauthCallback.
- Admins manage app team access in Linear; Alfred consumes webhooks at /api/linear/webhook.

### Token Procedures (issue/elevate)

packages/api/src/routers/token.ts:
```ts
import { router, authedProcedure } from "../index";
import { requireRecentBiometric } from "@alfred/auth/biometric";
import { issueAccessToken } from "@alfred/auth/token";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const tokenRouter = router({
  issue: authedProcedure
    .input(z.object({ scopes: scopesSchema, aud: z.string().optional(), ttlSec: ttlSchema }))
    .mutation(async ({ ctx, input }) => {
      const token = await issueAccessToken(ctx.session.user.id, input.scopes, input.aud ?? defaultAudience, {
        ttlSec: input.ttlSec,
        elevated: false,
        mfa: "none",
      });
      return { token };
    }),
  elevate: authedProcedure
    .input(z.object({ scopes: scopesSchema, aud: z.string().optional(), ttlSec: ttlSchema }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = ctx.session.session?.id ?? ctx.session.session?.token;
      if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireRecentBiometric(sessionId);
      const token = await issueAccessToken(ctx.session.user.id, input.scopes, input.aud ?? defaultAudience, {
        ttlSec: input.ttlSec,
        elevated: true,
        mfa: "passkey",
      });
      return { token };
    }),
});
```

Usage:
- Web client calls `getElevatedToolToken(["droid.exec"])` (`apps/web/src/lib/token.ts`) to copy a passkey-elevated token for manual testing.
- Droids/Proxmox tool handlers verify the `Bearer` token and enforce scopes plus elevation rules before acting.
- JWKS lives at `/api/jwks` for external verifiers; rotate keys by updating env vars and restarting services.

---

## Web, Desktop, Mobile Integration

- Web (TanStack Start): Primary UI with chat, streaming, and cache handoff. SSR guardrails: externalize server-only deps such as `@alfred/db`, `pg`, and `drizzle-orm/pg-core` in `apps/web/vite.config.ts`, and provide a browser stub export in `@alfred/db` so accidental client imports fail fast.
- Desktop (Tauri): Local device access and biometrics via platform APIs.
- Mobile (React Native + NativeWind): Remote control, notifications, voice capture.

### TanStack Query Cache Handoff on Client

```ts
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../trpcClient";

export function useDroidStream(prompt: string, auto: "read"|"low"|"medium"|"high", authz: string) {
  const qc = useQueryClient();
  trpc.droids.stream.useSubscription({ prompt, auto, out: "debug", authz }, {
    onData: (chunk) => {
      if (chunk?.type === "data-cache-handoff" && chunk.key && chunk.value) {
        qc.setQueryData(chunk.key, chunk.value);
      }
      // render debug/stdout lines live
    },
  });
}
```

### Generative UI (Floating Orb) and Voice

- Floating orb: implement in packages/ui; subscribes to agent/droid streams for visual feedback.
- Voice: Use Mastra voice patterns (speech-to-text and text-to-speech) with a local-friendly open-source stack:
  - STT: Faster-Whisper-based local inference where feasible.
  - TTS: Piper/Coqui TTS for low-latency synthesis.
- In UI, stream partial transcripts and synthesized audio chunks while preserving the same cache handoff approach.

---

### Voice & Call Flows (Assistant/Orchestrator)

- Turn-based (v1): Client records short utterances (3–10s), uploads to voice.sttTranscribe. The server runs STT and returns text. The client calls the selected agent’s stream/generate (Personal vs Orchestrator). The server synthesizes TTS via voice.ttsSynthesize and returns base64 audio or a URL. The client plays audio sequentially.
- Real-time (vNext): Optional WebRTC/full-duplex. Not required for initial milestones; capture as an Open Question.
- Safety in motion: Cap response length ("short mode"), summarize answers, and defer long actions for review post-drive.

### Drive Mode (Mobile)

- Big "Talk" button, large touch targets, haptic feedback on record start/stop.
- Half-duplex voice interactions with quick summaries and action confirmations.
- Agent switcher: toggle between Personal Assistant and Orchestrator. Escalate SWE tasks via "Send to Orchestrator" CTA; subscribe to orchestrator run streams and display progress succinctly.

## Deployment Architecture (Beelink + Proxmox)

Single-user, 24/7 home-lab deployment on a Beelink GTi Ultra Mini PC (Intel i9-13900HK, 32GB DDR5 RAM, 1TB NVMe SSD) running Proxmox VE (PVE). Mastra runs in-process inside the TanStack Start server—no separate Mastra HTTP server.

- Primary Host: Beelink GTi Ultra running Proxmox VE
- Topology (production-first but simple)
  - VM: alfred-core
    - OS: Ubuntu Server 24.04 LTS
    - vCPU: 8; RAM: 12–16 GB; Disk: 150–200 GB (thin)
    - Responsibilities:
      - TanStack Start app + tRPC backend with Mastra engine in-process (Node 20+)
      - Docker Compose services:
        - Postgres 16 + pgvector (primary DB)
        - Redis (token cache, jti replay defense, ephemeral queues)
        - OTEL Collector (optional)
        - Laminar (observability dashboard) or point to remote instance
      - Reverse proxy (Caddy) terminating TLS, routing apps AlFRED deploys
      - Local Docker buildx for building/running apps Alfred provisions
  - LXC: plex
    - vCPU: 4; RAM: 6–8 GB; Disk: per media needs
    - Hardware: Map Intel iGPU for QuickSync transcoding
  - Optional LXC: observability
    - If not colocating Laminar within alfred-core, run Laminar/Tempo/Loki here
- Storage
  - PVE: local-lvm or ZFS. If ZFS, create datasets for pgdata, redis, apps, backups
  - Docker volumes under /var/lib/docker/volumes
  - Bind mounts for Postgres (/var/lib/postgresql/data) and Laminar persistent data
- Networking
  - vmbr0 bridge to LAN; reverse proxy exposes 80/443
  - TLS via Let’s Encrypt (HTTP-01). Alternative: Tailscale/Cloudflare Tunnel
  - Suggested DNS:
    - alfred.example.com → TanStack + Mastra UI/API
    - observability.example.com → Laminar
    - plex.example.com → Plex LXC
    - <slug>.example.com → user apps Alfred deploys
  - Firewall:
    - Allow inbound 80/443 to reverse proxy only
    - Restrict admin ports (PVE 8006, SSH) to LAN and/or Tailscale ACLs
- Access
  - iPhone app (mobile), macOS Tauri desktop app, and browser clients
  - Physical Beelink access restricted to authorized devices
- Security
  - End-user auth via Better Auth (passkeys for biometric gating)
  - Agent-to-tool JWT with short-lived tokens and scopes; Redis-backed jti replay defense
  - No public exposure of Postgres or Redis; bind to localhost inside alfred-core VM
  - Secrets via env files on VM; mask in logs; keep off-box encrypted backups
- Observability
  - Mastra AI Tracing → OTEL Collector → Laminar
  - Trace IDs surfaced from tRPC responses for correlation
- Backups & Snapshots
  - PVE vzdump backups nightly for VM/LXC (7–14 day retention)
  - Postgres daily pg_dump (logical backups); consider WAL archiving for point-in-time recovery
  - Weekly tar of Docker volumes (apps data); test restore quarterly

Mermaid overview

```mermaid
graph TD
  PVE[Proxmox VE Host (Beelink GTi Ultra)]
  subgraph VM100[VM 100: alfred-core]
    RP[Reverse Proxy (Caddy)]
    TAN[TanStack Start + Mastra (tRPC, Node)]
    PG[(Postgres+pgvector via Docker)]
    RED[Redis]
    OTEL[OTEL Collector]
    LAM[Laminar (Observability UI)]
  end
  subgraph LXC200[LXC 200: Plex]
    PLEX[Plex Media Server]
  end
  Internet((Internet))
  Internet --> RP
  RP --> TAN
  TAN --> PG
  TAN --> RED
  OTEL --> LAM
  PVE --- VM100
  PVE --- LXC200
```

### Monitoring & Alerts (Prometheus, Grafana, Loki, Alertmanager)

Laminar will visualize AI/LLM traces. For everything else, deploy a lightweight, self-hosted monitoring stack on the alfred-core VM:
- Prometheus for metrics scraping
  - Scrape targets:
    - App: TanStack Start /api/metrics (Prometheus format)
    - Containers: cAdvisor
    - Postgres: postgres_exporter
    - Redis: redis_exporter
    - Reverse proxy: Caddy metrics endpoint
    - Blackbox: probe /healthz and deployed app URLs (preview and production)
    - Proxmox: prometheus-pve-exporter on the PVE host (CPU, memory, disks, VM/LXC state)
    - OTEL Collector: pipeline metrics
- Grafana for dashboards
  - Import dashboards: Node Exporter Full, PostgreSQL, Redis, cAdvisor, Blackbox, Reverse Proxy, custom Alfred app (tRPC, workflows, Droid runs)
- Loki + Promtail for logs
  - Tails journald (TanStack service) and Docker container logs; keep 7–14 days retention
- Alertmanager for notifications
  - E-mail and optional self-hosted ntfy/Gotify (no third-party SaaS required)
  - Policies:
    - CPU > 85% (10m); Memory > 90% (10m); Disk free < 15%
    - API: 5xx rate > 2% (5m), /healthz probe fails
    - Workflows/Droids: elevated non-zero droid exit rates; long suspend without resume
    - DB/Cache: Postgres connection saturation > 80%; Redis evictions > 0
    - Backups: pg_dump/vzdump last success > 26h
- Security
  - Expose /api/metrics only on LAN or behind auth; Grafana/Alertmanager with credentials and LAN/VPN access
- Files (suggested)
  - docker/monitoring/docker-compose.yml: prometheus, alertmanager, grafana, loki, promtail, cadvisor, blackbox-exporter
  - docker/monitoring/prometheus.yml: scrape_configs for the exporters listed above
  - docker/monitoring/alertmanager.yml: routes/receivers (email, optional ntfy)
  - docker/monitoring/promtail-config.yml: journald and Docker logs

### Proxmox Provisioning & App Deployments

Goal: Alfred must run apps it builds (e.g., a Next.js portfolio) safely and durably on the same host.

Approach (single-machine, single-user)
- Prefer Docker on alfred-core VM for simplicity; use reverse proxy for routes/TLS.
- For stronger isolation or long-lived, resource-heavy apps, Alfred can provision an LXC from a pre-baked template (Ubuntu 24.04 + Docker) via Proxmox API and deploy containers inside that LXC.

Provisioning flows
- Preview (ephemeral):
  1) Build Docker image from repo (Dockerfile), tag alfred/<slug>:<sha>.
  2) Run container with a random high host port (e.g., 30xxx).
  3) Register route: preview-<slug>-<shortsha>.<domain> → http://127.0.0.1:<port>.
  4) Health-check; return preview URL. Auto-cleanup after TTL (24–48h).
- Promote to production (stable):
  1) Stop prior container; run stable container name <slug>.
  2) Route <slug>.<domain> to the stable container.
  3) Health-check; rollback to previous image on failure.
- LXC isolation (optional):
  1) Create LXC from template (cores/memory/disk set, DHCP/static IP).
  2) Deploy Docker container(s) inside via SSH/API.
  3) Register route to LXC-IP:port.

Reverse proxy strategy
- Caddy (Admin JSON API)
  - Alfred upserts routes dynamically via Admin API
- TLS via Let’s Encrypt; HTTP/2 and optional HTTP/3

### Provisioning Tools (Mastra + JWT scopes)

Scopes
- proxmox.read, proxmox.power, proxmox.admin (LXC create/destroy)
- deploy.write (build/run/route)
- web.read (docs lookups)
- repo.read (if needed for build context)

Proxmox LXC tool (concept)
```ts
import { z } from "zod";
import { requireToolScopes } from "@alfred/auth/token";

export const toolProxmoxLxc = {
  name: "proxmoxLxc",
  description: "Provision and manage LXC containers in Proxmox",
  inputSchema: z.object({
    action: z.enum(["create","start","stop","destroy","snapshot","rollback"]),
    node: z.string(),               // e.g., "pve"
    vmid: z.number().optional(),    // for lifecycle ops
    templateVmid: z.number().optional(),
    hostname: z.string().optional(),
    cores: z.number().min(1).max(8).default(2),
    memoryMb: z.number().min(256).max(16384).default(2048),
    diskGb: z.number().min(8).max(200).default(20),
    netBridge: z.string().default("vmbr0"),
    authz: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    await requireToolScopes(input.authz, ["proxmox.admin"]);
    // Call Proxmox API (REST) to create/manage LXC
    return { ok: true };
  },
};
```

Docker tool (build/run)
```ts
import { z } from "zod";
import { requireToolScopes } from "@alfred/auth/token";

export const toolDocker = {
  name: "docker",
  description: "Build and run Docker images for app deployments",
  inputSchema: z.object({
    action: z.enum(["build","run","stop","rm"]),
    buildContext: z.string().optional(), // path
    tag: z.string().optional(),
    run: z.object({
      image: z.string().optional(),
      name: z.string().optional(),
      port: z.number().optional(),       // container port
      hostPort: z.number().optional(),   // host port
      env: z.record(z.string()).optional(),
      labels: z.record(z.string()).optional(),
      restart: z.enum(["no","always","on-failure"]).default("always"),
    }).optional(),
    authz: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    await requireToolScopes(input.authz, ["deploy.write"]);
    // spawn "docker build/run" safely (no shell), with timeout and cw sandbox
    return { ok: true };
  },
};
```

Router tool (Caddy)
```ts
import { z } from "zod";
import { requireToolScopes } from "@alfred/auth/token";

export const toolRouter = {
  name: "router",
  description: "Manage reverse proxy routes (Caddy)",
  inputSchema: z.object({
    action: z.enum(["register","update","remove"]),
    host: z.string(),     // subdomain
    upstream: z.string(), // http://127.0.0.1:3001
    tls: z.boolean().default(true),
    authz: z.string().optional(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input }) => {
    await requireToolScopes(input.authz, ["deploy.write"]);
    // Call Caddy Admin API to upsert/delete routes
    return { ok: true };
  },
};
```

### App Deployments Data Model (DB)

SQL migration (packages/db/src/migrations/0004_deployments.sql)
```sql
CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug text NOT NULL UNIQUE,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'preview', -- preview|active|failed|removed
  container_name text,
  ports jsonb, -- {"host":30081,"container":3000}
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deployments_status_idx ON deployments(status);
```

Drizzle schema (append to schema.ts)
```ts
import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const deployments = pgTable("deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  app: text("app_slug").notNull().unique(),
  domain: text("domain").notNull(),
  status: text("status").notNull().default("preview"),
  containerName: text("container_name"),
  ports: jsonb("ports"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

Repository helpers
```ts
import { db } from "./client";
import { deployments } from "./schema";
import { eq } from "drizzle-orm";

export async function upsertDeployment(input: {
  app: string; domain: string; status: string; containerName?: string | null; ports?: any;
}) {
  const now = new Date();
  await db.insert(deployments)
    .values({ ...input, created: now, updated: now })
    .onConflictDoUpdate({ target: deployments.app, set: { ...input, updated: now } });
}

export async function getDeployment(app: string) {
  const rows = await db.select().from(deployments).where(eq(deployments.app, app)).limit(1);
  return rows[0] || null;
}
```

### Deploy Procedures (tRPC): provision/build/run/route

```ts
import { router, authedProcedure } from "../trpc";
import { z } from "zod";
import { mastra } from "@alfred/agent";
import { upsertDeployment } from "@alfred/db/repo/deploy";

export const deployRouter = router({
  createPreview: authedProcedure
    .input(z.object({
      app: z.string(),
      imageTag: z.string(),
      hostPort: z.number().default(0), // 0 => auto assign
      domain: z.string(), // preview-<slug>-<sha>.<domain>
      authz: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const agent = mastra.getAgent("alfred");
      // 1) docker build/run (toolDocker)
      // 2) router.register (toolRouter)
      // 3) upsert deployments row
      await upsertDeployment({
        app: input.app,
        domain: input.domain,
        status: "preview",
        containerName: `preview_${input.app}`,
        ports: { host: input.hostPort, container: 3000 },
      });
      return { ok: true, url: `https://${input.domain}` };
    }),

  promote: authedProcedure
    .input(z.object({ app: z.string(), domain: z.string(), authz: z.string().optional() }))
    .mutation(async ({ input }) => {
      // swap to stable, update router
      await upsertDeployment({ app: input.app, domain: input.domain, status: "active" });
      return { ok: true, url: `https://${input.domain}` };
    }),

  remove: authedProcedure
    .input(z.object({ app: z.string(), authz: z.string().optional() }))
    .mutation(async ({ input }) => {
      // stop & remove; drop route; mark removed
      await upsertDeployment({ app: input.app, domain: "", status: "removed" });
      return { ok: true };
    }),
});
```

### Durability & Ops (24/7)

- Systemd supervision: TanStack server runs as a systemd service (Restart=always). Health endpoint /healthz.
- Docker restart policies: infra services use restart: always to survive reboots.
- Redis for token caching and jti replay defense; bind to localhost; configure AOF if you need persistence across VM restarts.
- Secrets management: AGENT_ED25519_PRIVATE (PKCS8 PEM) and related JWT keys stored in env; rotate KID/keys quarterly and republish JWKS; keep tokens short-lived (≤ 5 min).
- Proxmox durability: nightly vzdump for VM/LXC, plus ZFS snapshots if used; test restore quarterly.
- Postgres maintenance: VACUUM/ANALYZE weekly; backups via pg_dump; HNSW index tuning as corpus grows.
- Monitoring & alerts: trace errors, droid exit codes, workflow failures, webhook signature failures; disk usage thresholds; Laminar dashboards for traces and logs.

---

## Recursive Self-Improvement (Laminar Evals & Datasets)

Alfred improves over time by converting real usage (traces, feedback) into labeled datasets and executing controlled evaluations, with all changes gated by explicit human approval. We leverage Laminar for:
- Tracing LLM calls with rich metadata (reasoning, tokens, costs)
- Datasets curated from traces (via SQL Editor and export)
- Labeling queues for human-in-the-loop corrections
- Evaluations (Evals) with versioned datasets and scored results
- Dashboards and A/B comparisons using SQL and tags
- First-party eval metadata now lives in Postgres (`eval_defs`, `eval_datasets`, `eval_points`, `eval_runs`, `eval_scores`) with optional Laminar dual-write. Configure Laminar via `LMNR_PROJECT_API_KEY`, `LMNR_BASE_URL`, `LMNR_HTTP_PORT`, `LMNR_GRPC_PORT`, and toggle exports with `EVAL_LAMINAR_EXPORT`, `EVAL_LAMINAR_MODE`, `EVAL_LAMINAR_GROUP`.
- Built-in Mastra scorers (answer relevancy, prompt alignment, toxicity) attach to the orchestrator agent with sampling controlled by `EVALS_SAMPLING_RATE` for live traces, while batch runs flow through `packages/agent/src/eval/runner.ts`.
- The tRPC `eval` router provides owner-gated procedures (`eval.define`, `eval.dataset.create/add/list`, `eval.run.start/get/list/scores`) surfaced in Prometheus metrics (`eval_runs_total`, `eval_duration_seconds`, `eval_scores_total`, `eval_failures_total`, `laminar_eval_datapoints_total`, `laminar_eval_errors_total`).

Guiding principles
- Safety first: never auto-widen tool scopes or auto. Proposed changes are delivered as PRs or config diffs and require biometric-gated approval before rollout.
- Measurable improvement: candidates must outperform control on curated datasets and show positive deltas on live dashboards (no regressions).
- Isolation by experiment: variants are tagged in traces; dashboards and evals compare control vs candidate(s) to avoid unprincipled drift.

### Instrumentation: metadata, tags, and events

Attach experiment metadata to each trace and add structured events to correlate behavior with variants.

```ts
import { Laminar } from "@lmnr-ai/lmnr";

// Tag the trace with experiment context (e.g., for PA prompt tuning)
Laminar.setTraceMetadata({
  user: ctx.session?.user?.id ?? "anon",
  agent: input.agent,               // "assistant" | "alfred"
  experimentId: currentExperimentId,  // e.g., "pa-prompt-v3"
  variant: "control" | "candidateA",
});

// Optionally tag spans for categorization
// Laminar.addSpanTags(["experiment:pa-prompt-v3", "variant:candidateA"]);

// Emit structured events for critical steps (tool runs, outcomes)
Laminar.event({
  name: "orchestrator.task.result",
  attributes: {
    task: inputData.task,
    auto: inputData.auto,
    exit_code: code ?? 0,
  },
});
```

Recommended metadata fields
- experimentId, variant, agent, auto (when relevant)
- task kind (plan/edit/test/review/merge/docs), repo/module, runtime (drive_mode)

### Datasets from traces (curation + labeling queues)

Build datasets from real interactions:
- Use Laminar SQL Editor to query spans for problematic cases (e.g., negative feedback, droid failures, long latencies).
- Export results into a dataset; push items to a labeling queue for quick human corrections.
- Produce datapoints with standardized structure:
  - data: { messages/context/inputs, relevant metadata }
  - target: expected output or evaluator hints (e.g., JSON schema, rubric)
- Version datasets as they evolve; keep "golden sets" stable for regression tests.

Example SQL idea (in Laminar SQL Editor)
```
SELECT id, input, output
FROM spans
WHERE name = 'openai.chat'
  AND metadata->>'experimentId' = 'pa-prompt-v3'
ORDER BY start_time DESC
LIMIT 100;
```

### Evaluation harness and workflow

Define a workflow that runs candidates against datasets and records results to Laminar Evals. Candidates differ in prompts/instructions, memory templates, tool descriptions, or workflow policies (never scopes/auto).

Workflow outline (agent-evals):
1) initEval: create a Laminar eval run (grouped by experiment or agent).
2) runVariant: for each variant, execute the agent on each datapoint in the dataset.
   - Record executor outputs and scores (binary pass, graded, or rubric-based).
   - Save datapoints via Laminar’s Save Evaluation Datapoints API.
3) summarize: compare results across variants; compute deltas vs control.
4) proposeChanges: generate a config diff or PR with recommended edits.
5) gate: require biometric-gated approval before merging and rolling out; allow staged A/B rollout.

API sketch (server-side):
```ts
// 1) Initialize eval
const initResp = await fetch("https://api.lmnr.ai/v1/evals", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.LMNR_PROJECT_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: experimentId,
    groupName: "alfred-self-improve",
  }),
}).then(r => r.json());

// 2) Save datapoints/results
await fetch(`https://api.lmnr.ai/v1/evals/${initResp.id}/datapoints`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.LMNR_PROJECT_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    points: [
      {
        data,                    // input payload
        target,                  // expected output
        executorOutput: { variant, response, metrics },
        scores: { pass: Number(score) },
      },
    ],
  }),
});
```

What to evaluate (safe levers)
- Personal Assistant: system instructions, memory template fields, tool descriptions (safe caps), "short mode" in drive_mode
- Orchestrator: planning prompts ("plan-before-do" balance), acceptance checks, retry/roadblock strategies, review/merge presets
- Guardrails thresholds (moderation level); never expand tool scopes or auto automatically

### A/B variants and rollout policy

- Tag variants in traces via metadata.
- Build Laminar dashboards to compare:
  - Helpfulness (from user_feedback or labeler scores)
  - Task success rates
  - droid_exec non-zero exit rate
  - Latency/TTFT
- Promotion policy:
  - Candidate must surpass control by a pre-set threshold on curated dataset(s) AND show no regressions on key live metrics
  - Changes are proposed as PRs/config diffs and require explicit biometric approval

### Integration with personalization/feedback

- Feed user_feedback into datasets: push negative cases to queues quickly.
- Leverage user_events (e.g., drive_mode, auto adjustments) as context for evaluation.
- Use personalization facts/preferences to construct stratified datasets (e.g., "short mode" adherence while driving).

### Ops integration (metrics & alerts)

Prometheus metrics (examples)
- eval_runs_total{agent,experimentId,status}
- eval_dataset_size{datasetId}
- eval_score_gain{experimentId,variant}
Alerts
- Repeated eval failures (status=failed)
- Score gain negative or unstable across runs

### Safety and governance

- All self-improvement changes are reversible; PR-based with audit logs.
- Enforce approval gates (biometric passkeys) before rollout.
- Never widen tool scopes or auto ceilings via this pipeline; such changes require separate, explicit user action.

### Open questions
- Cadence and triggers: nightly schedule vs threshold-based triggers (e.g., failure spikes)
- Score aggregation: unify multi-metric scores (weighted approach)
- Dataset drift detection: alerts if inputs distribution shifts significantly

---

## Dev/CI/CD

### Local Postgres + pgvector via Docker

```bash
cd docker/postgres
docker compose up -d
```

### Migrations and Seeds (RAG + Graph)

packages/db/scripts/migrate.ts:
```ts
import "dotenv/config";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const files = ["0000_extensions.sql", "0001_init.sql", "0002_linear.sql"];
  for (const f of files) {
    const sql = fs.readFileSync(path.join(__dirname, "../src/migrations", f), "utf8");
    await client.query(sql);
  }
  await client.end();
  console.log("Migrations applied.");
}
main().catch((e) => { console.error(e); process.exit(1); });
```

packages/agent/scripts/seed-rag.ts:
```ts
import "dotenv/config";
import { ingestTextDocument } from "../src/rag";

async function main() {
  const docId = await ingestTextDocument("kb://examples/returns-policy","Returns Policy","Acme returns policy text...");
  console.log("Ingested doc:", docId);
}
main();
```

Graph seed example (requirements/tickets links):
```ts
import { upsertNode, addEdge } from "@alfred/db/repository";
async function seedGraph() {
  const req = await upsertNode("requirement","Add biometric gating",{ priority:"high" });
  const ticket = await upsertNode("ticket","SEC-101",{ status:"open" });
  await addEdge(req.id, ticket.id, "tracked_by", 1.0, {});
}
```

### Testing (Vitest), Linting, Turborepo Pipelines

- Vitest tests for tools (droidExec, proxmox), orchestrator, and RAG repository.
- Husky hooks for lint/format; Biome via Ultracite config.
- Turbo tasks:
  - build: build all packages
  - dev: run apps/web + watch engine/auth/db
  - test: run unit tests
  - migrate: run migration script
  - seed: run RAG/graph seed

---

## Milestones

1) Scaffold & Infra (Week 1)
- Run scaffold command
- Launch Docker Postgres with pgvector
- Create packages: api, engine-mastra, db, auth, ui, types
- Apply migrations; verify DB connectivity

2) Core Engine + Orchestrator (Weeks 2–3)
- Implement Mastra instance with PostgresStore and observability defaults
- Add alfred agent with tools (weather, ticket, proxmox, droidExec)
- Implement plan (plan → foreach → droidExec)
- Add graph memory schema and repository

3) Droids & Streaming (Weeks 3–4)
- Implement droidExec tool with streaming and auto controls
- Implement listDroids tool and tRPC endpoints (list/run/stream)
- Integrate Stream-to-Cache handoff; build orb UI feedback

4) Auth & Security (Week 4)
- Implement JWT token exchange, JWKS, and scope enforcement (droid/proxmox)
- Add token caching & refresh buffer
- Wire auth; add biometric gating in UI + workflow suspend/resume

5) RAG + Proxmox Tools (Week 5)
- RAG ingestion/retrieval and reranking
- Proxmox management tool (power operations)
- Observability dashboards (trace correlation in UI)

6) CI/CD + Evals (Week 5–6)
- Add GitHub Actions with Droid Exec automated code review
- Add Vitest coverage for tools/workflows
- Tune pgvector indexes and topK settings

7) UX Polish & Docs (Week 6)
- Finalize floating orb and speech-to-speech flows
- Author developer docs: local dev, migrations, Droids usage
- Security review (key mgmt, scopes, biometrics)
- Performance tuning for Droid task streaming

---

## Risk Register and Mitigations

- Droids auto safety: Enforce scope-based authorization and biometric gating; default read-only auto; audit log events.
- Streaming complexity: Use Mastra observable streams; validate chunk schemas; add backpressure if needed.
- pgvector performance: Use HNSW index; tune topK and distance ops; consider IVFFlat if corpus grows large.
- Proxmox ops risk: Restrict scopes; require explicit user confirmation; add dry-run checks in tools.
- Multi-client biometric support: WebAuthn for web, platform APIs for desktop/mobile; fallback path disables high-risk actions.

---

## Open Questions

- Scope catalog granularity for Droids and Proxmox (e.g., `droid.exec.plan`, `proxmox.snapshot`).
- Speech stack selection defaults (local vs hybrid) per device.
- Ticketing integration depth (Linear project/label conventions; two-way sync).
- Orchestrator graph semantics for long-lived planning (node/edge type taxonomy).

---

## Orchestrator Hierarchical Planning + Droids Execution Model

This section defines how Alfred’s Orchestrator plans and executes complex work using Droids. It introduces:
- Two plan artifacts with validation: a high-level Implementation Plan and per-module Module Plans.
- Execution scheduling for sequential vs. parallel runs (parallel uses git worktrees).
- Git branching strategies; specialized Droids for review/merge/docs.
- Roadblock handling, escalation, and web-assisted retries.
- Streaming, observability, and tRPC endpoints for end-to-end execution.

### Plan artifacts and validation

Canonical format is JSON validated with Zod; JSON Schema is generated for constrained LLM outputs. Markdown with YAML frontmatter is optionally supported for human review but converted to canonical JSON before execution.

Type definitions (Zod):
```ts
import { z } from "zod";

export const zExecutionMode = z.enum(["sequential", "parallel"]);
export const zAutonomy = z.enum(["read", "low", "medium", "high"]);

export const zModuleSpec = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  scope: z.array(z.string()),
  constraints: z.array(z.string()).optional().default([]),
  dependencies: z.array(z.string().uuid()).optional().default([]),
  acceptanceCriteria: z.array(z.string()),
  repoPath: z.string(), // monorepo path for module work
  execution: z.object({
    mode: zExecutionMode,
    auto: zAutonomy,
    maxParallelTasks: z.number().int().min(1).max(8).default(2),
    allowWeb: z.boolean().default(true),
  }),
  branching: z.object({
    strategy: z.enum(["single-feature", "per-module", "per-task"]).default("per-module"),
    base: z.string().default("origin/main"),
    prefix: z.string().default("feature"),
    requireWorktree: z.boolean().default(false),
  }),
});

export const zImplementationPlan = z.object({
  version: z.literal("v1"),
  run: z.string().uuid(),
  requirement: z.string(),
  goals: z.array(z.string()).min(1),
  modules: z.array(zModuleSpec).min(1),
  global: z.object({
    execution: z.object({
      mode: zExecutionMode,
      auto: zAutonomy,
      maxParallelModules: z.number().int().min(1).max(8).default(2),
    }),
    branching: z.object({
      strategy: z.enum(["single-feature", "per-module"]).default("per-module"),
      base: z.string().default("origin/main"),
      prefix: z.string().default("feature"),
      remoteName: z.string().default("origin"),
    }),
    policies: z.object({
      requireBio: z.array(z.string()).default(["auto:medium","auto:high"]),
      requirePR: z.boolean().default(true),
      owners: z.array(z.string()).default([]),
    }),
  }),
});

export const zTaskKind = z.enum(["analysis","edit","test","refactor","review","merge","docs"]);
export const zTask = z.object({
  id: z.string().uuid(),
  title: z.string(),
  kind: zTaskKind,
  cw: z.string(),
  auto: zAutonomy,
  prompt: z.string(),
  artifacts: z.array(z.object({ path: z.string(), kind: z.string().default("file") })).default([]),
  dependsOn: z.array(z.string().uuid()).default([]),
  allowWeb: z.boolean().default(false),
  timeoutSec: z.number().int().min(30).max(7200).default(1800),
});

export const zModulePlan = z.object({
  version: z.literal("v1"),
  run: z.string().uuid(),
  moduleId: z.string().uuid(),
  moduleSlug: z.string(),
  branch: z.string(),
  worktreePath: z.string().optional(),
  tasks: z.array(zTask).min(1),
  acceptanceChecks: z.array(z.string()),
  execution: z.object({
    concurrency: z.number().int().min(1).max(8).default(2),
    strategy: z.enum(["parallel","sequential"]).default("sequential"),
  }),
});

export type ImplementationPlan = z.infer<typeof zImplementationPlan>;
export type ModulePlan = z.infer<typeof zModulePlan>;
```

Generate JSON Schema (for model-constrained outputs):
```ts
import { zodToJsonSchema } from "zod-to-json-schema";
export const implementationPlanSchema = zodToJsonSchema(zImplementationPlan, { name: "ImplementationPlan" });
export const modulePlanSchema = zodToJsonSchema(zModulePlan, { name: "ModulePlan" });
```

Optional Markdown I/O helpers:
- parsePlanMarkdown(md): YAML frontmatter → JSON → Zod.parse
- stringifyPlanMarkdown(plan): YAML frontmatter + body summary

### Persistence and graph mapping

Use Graph Memory tables defined earlier:
- memory_nodes kinds: plan, module, task, run
- memory_edges kinds: contains, depends_on, executes

Edges:
- plan contains module; module contains task; task depends_on task; run executes module/task

Optionally cache canonical JSON in a lightweight plans table if needed for quick reads.

### Orchestrator workflow (plan → schedule → execute → merge → docs → finalize)

Steps (Mastra createStep/createWorkflow), streaming progress and cache handoff:

1) synthesizeHighLevelPlan
- Input: requirement, repoRoot, defaults
- LLM produces ImplementationPlan JSON conforming to implementationPlanSchema; validate; retry on failure.
- Output: plan

2) validateAndPersistPlan
- Validate with Zod, upsert plan/module nodes, save JSON, create run node.
- Output: { run, planNodeId }

3) expandModulesToModulePlans
- For each moduleSpec, generate a ModulePlan JSON; set cw and execution.strategy per plan/global; validate and persist.
- Output: modulePlans[]

4) chooseSchedulingAndPrepareVC
- If global.execution.mode is parallel:
  - Create base feature branch feature/<slugified-requirement>-<run> from base.
  - For each module: create branch feature/<slug>-<run>; add worktree at .worktrees/<moduleSlug>-<run>.
- If sequential: create single feature/<run> branch; no worktrees.
- Output: vcs map (branches/worktrees)

5) executeModulePlan
- For each module plan:
  - Determine cw: worktreePath || path.join(repoRoot, module.repoPath)
  - Run tasks:
    - strategy parallel → foreach with concurrency=modulePlan.execution.concurrency
    - strategy sequential → respect dependsOn ordering
  - Each task invokes droidExec with streaming (out "debug"), auto per task, and cw.
  - On success: verify acceptance checks; commit changes; optionally push.
  - On failure: handleRoadblock.
- Output: per-module summary and artifacts

6) handleRoadblock (progressive fallback)
- quickReplan: rephrase task with more context; retry once
- webAssist: fetch web docs (tool web.fetch) and retry once
- escalate: emit Linear elicitation; suspend() and wait for resume() with guidance or elevated scopes (biometric-gated)

7) codeReviewAndMerge (serialized)
- Use droid presets: codeReviewer (read-only) on diff, mergeCoordinator (low/medium auto) to resolve conflicts per policy.
- Merge into base feature branch. Optionally open PRs in CI/CD.

8) generateDocs
- Use docsWriter preset to update README/CHANGELOG/docs per module; commit.

9) finalizeRun
- Persist results; emit Stream-to-Cache Handoff:
```ts
await writer?.write({
  type: "data-cache-handoff",
  key: ["runs", run],
  value: { status: "completed", modules: summaries }
});
```

### Git branching strategies and worktrees

- Default:
  - global.parallel → per-module branches + worktrees
  - global.sequential → single feature branch
- Naming:
  - Base: feature/<slugified-requirement>-<run>
  - Module: feature/<moduleSlug>-<run>
  - Worktree dir: .worktrees/<moduleSlug>-<run>
- Merge policy:
  - Rebase module branch on base before merge
  - Merge module branches serially into base feature branch
- Safety:
  - All git mutations happen under cw (worktree); never force-push by default

### Dedicated Droid roles

- General executor: tool droidExec (non-interactive). Autonomy defaults to read/low; medium/high require biometric-gated token.
- Code reviewer: preset wrapper around droidExec in read-only; returns structured comments (path, position, body).
- Merge coordinator: preset wrapper to resolve conflicts safely; auto low/medium only; no force push.
- Docs writer: preset wrapper to generate/update docs; auto low.

Custom Droids (subagents) loader can surface project- or personal-scoped droids (.factory/droids/*.md) for targeted sub-tasks.

### Droids lifecycle

- Start:
  - Orchestrator obtains JWT tool token with scopes (e.g., droid.exec, repo.write).
  - Build prompt from task + acceptance criteria; set cw and auto.
- Monitor:
  - Stream stdout/debug lines to tRPC and optionally to Linear as action activities.
  - Enforce task timeoutSec (default 30m).
- Finish:
  - Exit code 0 and acceptance checks satisfied; commit/push as configured.
- Roadblocks:
  - Enter handleRoadblock flow; may suspend workflow for human input via Linear elicitation.

### Web search and external docs

- tool web.fetch (scope web.read) retrieves small pages (content-type text/* or application/json, size-capped) to enrich failing tasks.
- For richer search, optionally integrate MCP web search (future extension); gate by policy.

### tRPC endpoints for orchestration

- orchestrator.planHighLevel({ requirement, repoRoot, defaults })
  - Returns { plan, traceId }
- orchestrator.planModules({ plan })
  - Returns { modulePlans, traceId }
- orchestrator.run({ plan, modulePlans?, authz? })
  - Returns { run, status: "started" }
- orchestrator.stream({ plan, modulePlans?, authz? })
  - Emits progress/droid/git/review/merge/docs and final data-cache-handoff
- orchestrator.resume({ run, guidance?, elevatedAuthz? })
  - Resumes suspended steps

All endpoints enforce end-user session via Better Auth; tools are scope-protected via agent-to-tool JWT.

### Streaming and cache handoff

- Use writer.write() within steps to stream progress.
- Final or per-module handoff:
```ts
await writer?.write({
  type: "data-cache-handoff",
  key: ["runs", run, "modules", moduleSlug],
  value: moduleSummary
});
```
- Client handler sets TanStack Query cache to avoid flicker and redundant refetches.

### Observability

- AI Tracing enabled; include traceId in plan and run responses.
- Tag spans with run, moduleSlug, taskId.
- Optional OTEL exporters (SigNoz, Langfuse, Braintrust, Mastra Cloud) can be enabled via env.

### Risk considerations

- Repo integrity: serialize merges; restrict auto; avoid force operations.
- Disk usage: prune worktrees upon completion/abort.
- Timeouts and retries: per-task timeout with capped retries; escalate when needed.
- Secrets hygiene: do not leak FACTORY_API_KEY beyond the droid process; scope env carefully.

### Open items for stakeholder input

- Default per-package test/build commands for acceptance checks.
- Whether to open PRs automatically or keep merges local by default.
- Approval matrix for auto elevation (who can grant medium/high).
- Default parallelism limits per repo size and CI capacity.

---

## Appendix A: Data Flow (Mermaid)

```mermaid
sequenceDiagram
  participant UI as Clients (Web/Desktop/Mobile)
  participant TRPC as tRPC (packages/api)
  participant WH as Webhook (/api/linear/webhook)
  participant M as Mastra (packages/agent)
  participant D as Droids (droid exec)
  participant LN as Linear API
  participant DB as Postgres+pgvector

  UI->>TRPC: workflow.stream({ requirement, auto })
  TRPC->>M: plan.streamVNext(...)
  M-->>M: planTasks (Agent prompt)
  loop foreach task
    M->>D: droid exec (auto, model, cw)
    D-->>M: debug/stdout events + artifacts
  end
  M->>LN: createAgentActivity (thought/action/response) and comments
  LN-->>WH: AgentSessionEvent (created/prompted)
  WH->>TRPC: dispatch webhook event
  TRPC->>M: start/continue run (ack within 10s via thought)
  M->>DB: persist graph/memory + linear installation/token usage
  M-->>TRPC: stream events (progress, droid, cache-handoff)
  TRPC-->>UI: streaming chunks
  UI-->>UI: setQueryData on handoff to avoid flicker
```

---

# Selected Code Index

- packages/agent/src/index.ts — Mastra instance, storage, observability
- packages/agent/src/agents.ts — ALFRED agent with Droids/Proxmox tools and guardrails
- packages/agent/src/workflows.ts — plan planning and Droids execution
- packages/agent/src/tools/droid.ts — Headless Droid Exec tool with streaming, scope, and policy enforcement
- packages/db/src/schema.ts — Drizzle schema for RAG tables and graph memory
- packages/db/src/migrations/0001_init.sql — pgvector + graph memory schema and indexes
- packages/db/src/migrations/0008_indexes.sql — Assistant task/reminder/timer indexes
- packages/db/src/migrations/0009_uniques.sql — Uniqueness constraints (preferences, autonomy, Linear installations)
- packages/db/src/migrations/0010_vector_index.sql — HNSW cosine indexes for embeddings
- packages/db/src/migrations/0011_passkey.sql — Better Auth passkey tables
- packages/db/src/repository.ts — RAG and graph helper methods
- packages/auth/src/biometric.ts — Bio-ticket helpers with Redis fallback
- packages/auth/src/token.ts — Ed25519 tool token issuance/verification with replay defense
- packages/policy/src/types.ts — policy document/subject/resource types
- packages/policy/src/load.ts — YAML loader + cache
- packages/policy/src/rule.ts — rule matcher
- packages/policy/src/pdp.ts — evaluator + caching
- packages/policy/src/decide.ts — decision combiner
- packages/api/src/rpc/agent.ts — agent.generate / agent.stream (tRPC)
- packages/api/src/rpc/workflow.ts — orchestrator.start / orchestrator.stream (tRPC)
- packages/api/src/rpc/tool.ts — proxmox power operations with scopes
- packages/api/src/routers/droids.ts — secure droid exec run/stream
- packages/api/src/routers/token.ts — token.issue / token.elevate procedures
- packages/api/src/gate.ts — policy middleware for tRPC
- apps/web/src/routes/api/metrics.ts — Prometheus metrics endpoint
- apps/web/src/routes/api/jwks.ts — JWKS (public) endpoint
- apps/web/src/routes/healthz.ts — liveness endpoint
- apps/web/src/routes/healthz/deps.ts — dependency readiness endpoint
- apps/web/src/lib/auth-client.ts — Better Auth client with passkey plugin
- apps/web — UI, TanStack Query cache handoff, voice, biometrics, floating orb

---

Notes:
- Architecture is Mastra-first for agents, workflows, memory, RAG, streaming, and observability.
- Droids are the primary headless SWE executor integrated as a secure Mastra tool with auto gating and streaming.
- The plan includes biometric checks for high-risk actions, graph memory for orchestration, and a clear CI path via Droid Exec automated review.
