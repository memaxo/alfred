# ALFRED

> **A**utonomous **L**earning **F**ramework for **R**easoning, **E**xecution & **D**ecision-making

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3+-f9f1e1.svg)](https://bun.sh/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org/)

<!-- TODO: Add hero screenshot/GIF showing Mindscape with active workflow -->
![ALFRED Desktop](docs/assets/hero-placeholder.png)

A privacy-first, fully offline personal AI assistant built for deep hyperpersonalization. ALFRED runs entirely on your hardware—no cloud dependencies, no data leaving your network, no compromises.

🔒 **Offline-First** · 🧠 **Self-Improving** · 🔧 **Modular** · 🛡️ **Secure** · ⚡ **Fast**

---

## Table of Contents

- [Why ALFRED?](#why-alfred)
- [What Can ALFRED Do?](#what-can-alfred-do)
- [Quick Start](#quick-start)
- [Features](#features)
- [How It Works](#how-it-works)
- [Self-Evolution: How ALFRED Learns](#self-evolution-how-alfred-learns)
- [Architecture](#architecture)
- [Cerebras Fast LLM Integration](#cerebras-fast-llm-integration)
- [Cognitive State Machine](#cognitive-state-machine)
- [Personality Hyperparameters (Planned)](#personality-hyperparameters-planned)
- [Agent Client Protocol (ACP)](#agent-client-protocol-acp)
- [Execution Engines (Codex & Droid)](#execution-engines-codex--droid)
- [Local Voice Pipeline](#local-voice-pipeline)
- [Neural Orb & Face Evolution](#neural-orb--face-evolution)
- [Terminal UI (TUI)](#terminal-ui-tui)
- [Desktop Shell](#desktop-shell)
- [Generative UI (Planned)](#generative-ui-planned)
- [Model Finetuning](#model-finetuning)
- [Linear Project Management](#linear-project-management)
- [Security Model](#security-model)
- [Performance & Fast Feedback](#performance--fast-feedback)
- [Installation](#installation)
- [Configuration](#configuration)
- [Self-Hosting](#self-hosting)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Observability](#observability)
- [iOS App](#ios-app)
- [Roadmap](#roadmap)
- [Development](#development)
- [Documentation](#documentation)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Why ALFRED?

**You own your AI.** Every model runs locally. Every byte of data stays on your infrastructure. ALFRED is designed for self-hosters who refuse to trade privacy for intelligence.

### Core Philosophy

- **Offline-First**: Local STT (Faster-Whisper), local TTS (Piper), local embeddings (KaLM-Embedding-Gemma3-12B). Cloud APIs are optional fallbacks, never requirements.
- **Hyperpersonalized**: Single-user architecture enables aggressive learning without multi-tenancy overhead. ALFRED learns *your* workflows, *your* infrastructure, *your* preferences.
- **Open & Modular**: Every package is composable. Swap embedding models, plug in different voice backends, extend the knowledge graph—the architecture bends to your needs.
- **Security by Design**: Biometric elevation for dangerous operations, Ed25519 token signing, policy engine with audit logging. Trust nothing, verify everything.
- **Performance Obsessed**: Sub-100µs cognitive transitions, <1ms graph queries, <10ms RAG retrieval. Speed is a feature.

---

## What Can ALFRED Do?

### Infrastructure Management

> *"Deploy the preview environment for the auth-refactor branch"*

ALFRED creates Docker containers, runs migrations, deploys the preview, and returns the URL—all while learning which deployment patterns you prefer.

### Knowledge Capture

> *"Remember that the staging server is on proxmox-node-2"*

Information persists to a knowledge hypergraph, surfaces in future queries, and connects to related facts automatically.

### Workflow Automation

> *"When PRs are approved in Linear, merge and deploy to preview"*

ALFRED creates persistent workflows that monitor your tools and execute autonomously—with configurable trust levels that expand as it proves reliability.

### Voice-First Interaction

> *"Alfred, what did the agents accomplish overnight?"*

Natural voice commands with local speech-to-text and text-to-speech. No cloud transcription—your conversations stay private.

---

## Quick Start

Get ALFRED running in under 5 minutes:

```bash
# Clone and install
git clone https://github.com/memaxo/alfred.git
cd alfred
bun install

# Configure environment
cp config/env.example .env
bun scripts/gen-keys.ts >> .env
# Edit .env: set OPENAI_API_KEY (or run fully local)

# Start database
bun run db:start    # Launches PostgreSQL with pgvector
bun run db:migrate  # Applies schema migrations

# Launch ALFRED
bun run dev         # Web app at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) to access the web interface.

> 💡 **Want full privacy?** See [Local Models Installation](#local-models-full-privacy) for offline STT/TTS and local LLM support.

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Chat Interface** | 🚧 Beta | Conversational AI with tool execution |
| **Voice S2S** | 🚧 Beta | Local speech-to-speech with Maya1/NeMo (Python) |
| **Agent Client Protocol** | 🚧 Beta | Standardized agent-client communication (ACP) |
| **Codex Engine** | 🚧 Beta | Primary Rust-based execution and reasoning engine |
| **Droid Integration** | 🚧 Beta | Secure, sandboxed deterministic task execution |
| **Knowledge Graph** | ✅ Stable | Hypergraph-based memory with semantic search |
| **Mindscape Visualization** | 🚧 Beta | Spatial knowledge canvas |
| **Workflow Engine** | 🚧 Beta | Multi-step autonomous task execution |
| **Agent Wave Orchestration** | 🚧 Beta | Parallel multi-agent task decomposition |
| **Tool System** | ✅ Stable | Extensible MCP-compatible tool framework |
| **Bayesian Autonomy** | ✅ Stable | Trust levels that adapt based on outcomes |
| **Cognitive State Machine** | 🚧 Beta | Event-sourced states with physiology regulation |
| **Docker Integration** | 🚧 Beta | Container management and deployment |
| **Linear Integration** | 🚧 Beta | Issue tracking with agent activities |
| **Biometric Security** | 🚧 Beta | Passkey elevation for high-risk operations |
| **Terminal UI (TUI)** | 🚧 Beta | Headless dashboard with OpenTUI React |
| **Neural Orb** | 🚧 Beta | WebGL presence indicator with state mapping |
| **Cerebras Integration** | 🚧 Beta | 2,100 tok/s fast LLM inference |
| **Model Finetuning** | 🚧 Beta | MLX/LoRA adapters on interaction history |
| **Desktop Shell UI** | 🚧 Beta | JARVIS-inspired window manager, orb, components |
| **Desktop Native Wrapper** | 📋 Planned | Buntralino packaging (Bun + Neutralino.js) |
| **iOS Companion** | 🚧 Beta | React Native mobile interface |
| **Generative UI** | 📋 Planned | LLM-generated dynamic components |
| **Neural Face** | 📋 Planned | Orb evolution to facial expressions |
| **Home Assistant** | 📋 Planned | Smart home integration |
| **Desktop Evolution** | 📋 Planned | JARVIS-inspired spatial desktop environment |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         ALFRED Core                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Chat UI   │  │  Voice Orb  │  │  Mindscape  │  Interfaces │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Orchestrator                            │ │
│  │   Routes requests • Selects tools • Manages context        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Cognitive  │  │  Knowledge  │  │    Agent    │    Core     │
│  │   Engine    │  │   Graph     │  │   System    │  Packages   │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                 PostgreSQL + pgvector                      │ │
│  │   Relational data • Vector embeddings • Knowledge store    │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Systems

| System | Purpose |
|--------|---------|
| **Cognitive Engine** | Manages autonomy levels, physiology state, and self-improvement loops |
| **Knowledge Graph** | Stores facts, relationships, and memories in a queryable hypergraph |
| **Agent System** | Executes tools, manages workflows, and coordinates multi-step tasks |
| **Orchestrator** | Routes requests, selects appropriate tools, and maintains conversation context |

---

## Self-Evolution: How ALFRED Learns

ALFRED improves continuously through multiple interconnected learning systems. Unlike static assistants, every interaction makes ALFRED more attuned to *your* specific needs.

### The Learning Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interaction                            │
│         Voice command, chat, workflow trigger                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                   Execute with Prediction                      │
│  ALFRED predicts outcome → executes → compares actual result   │
└───────────────────────────┬───────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │ Autonomy │    │ Knowledge│    │ Mistake  │
     │ Gradient │    │Hypergraph│    │ Ledger   │
     └────┬─────┘    └────┬─────┘    └────┬─────┘
          │               │               │
          ▼               ▼               ▼
   Beta prior        Facts, relations,  Categorized
   updated with      insights persist   errors with
   success/failure   and strengthen     trend analysis
          │               │               │
          └───────────────┼───────────────┘
                          ▼
               ┌─────────────────────┐
               │  Next Interaction   │
               │  More personalized  │
               └─────────────────────┘
```

### Four Learning Mechanisms

- **Bayesian Autonomy**: Trust levels update based on success/failure history using beta distributions
- **Pattern Extraction**: Successful workflows become reusable templates
- **Mistake Ledger**: Errors are recorded and inform future decisions
- **Memory Decay**: Unused knowledge fades; active recall reinforces important facts

### Bayesian Autonomy Gradient

ALFRED maintains a Beta distribution prior that learns when to act autonomously vs. when to ask for confirmation. Success increases alpha (trust), failure increases beta (caution), and user overrides significantly increase beta (learn from correction). The autonomy level decays toward baseline over time—if you haven't used ALFRED in a while, it becomes more conservative until it re-learns your patterns.

### Self-Supervision System

Every workflow records prediction errors that become knowledge. ALFRED compares predicted outcomes to actual results, calculates divergence, and generates KnowledgeInsights with confidence scores that persist to the hypergraph for future context building.

### Mistake Ledger & Pattern Detection

Errors are categorized, tracked over time, and analyzed for trends:

- **Pattern Detection**: 5+ errors in a category triggers "systematic issue" insight
- **Trend Analysis**: Compares first-half vs. second-half error rates
- **Actionable Insights**: Declining categories surface as concerns requiring attention

### Knowledge Graph Reinforcement

The hypergraph uses active recall—nodes strengthen when retrieved:

- **Memory Decay**: Unused knowledge gradually fades (configurable safety rails)
- **Recall Reinforcement**: Retrieved facts increase in confidence
- **Causal Chains**: Decisions link to outcomes, enabling "why did this work?" queries
- **Pattern Promotion**: Successful sequences become first-class pattern nodes

### Physiology-Regulated Learning

ALFRED's cognitive state influences learning intensity:

| State | Learning Mode |
|-------|---------------|
| High Energy | Aggressive pattern extraction, broader exploration |
| Low Energy | Conservative updates, stick to known patterns |
| High Frustration | Record mistakes with higher weight, reduce autonomy |
| Boredom | Seek novel approaches, increase experimentation |

### What ALFRED Learns

| Domain | Examples |
|--------|----------|
| **Tool Preferences** | You prefer `git rebase` over `git merge` |
| **Infrastructure** | Your staging server is `proxmox-node-2`, production is `proxmox-node-1` |
| **Workflows** | Deploy sequence: lint → test → build → deploy preview → notify Slack |
| **Timing** | You review PRs in the morning, prefer async updates in afternoon |
| **Communication** | Brief responses for routine tasks, detailed for complex ops |
| **Error Recovery** | When Docker build fails, you usually want to see the last 50 log lines |

### The Result

After weeks of use, ALFRED:
- Predicts your next command with high accuracy
- Executes routine workflows without confirmation
- Asks for approval only on genuinely ambiguous requests
- Surfaces relevant context before you ask for it
- Avoids past mistakes in similar situations

This isn't configuration—it's emergent behavior from continuous self-supervision.

→ [Deep dive: Learning Architecture](docs/architecture/learning.md)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interfaces                          │
│  Web (TanStack Start)  │  Desktop (Buntralino)  │  iOS (Expo)   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                     API Layer (tRPC v11)                        │
│        Streaming  │  Workflows  │  Voice  │  Admin              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    Runtime Orchestration                        │
│   Agent Waves  │  Tool Execution  │  Context Building           │
└────┬──────────────────┬───────────────────┬─────────────────────┘
     │                  │                   │
┌────┴────┐      ┌──────┴──────┐     ┌──────┴──────┐
│ Cognitive│      │  Knowledge  │     │   Learning  │
│  Cortex  │      │  Hypergraph │     │   System    │
└──────────┘      └─────────────┘     └─────────────┘
     │                  │                   │
┌────┴──────────────────┴───────────────────┴─────────────────────┐
│                      Infrastructure                             │
│  PostgreSQL + pgvector  │  Local Voice  │  Local Embeddings     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Systems

**Cognitive Cortex** (`packages/cognitive`, `packages/cortex`)
- Event-sourced state machine: idle → thinking → deciding → acting → learning → reflecting
- Physiology system tracking energy, boredom, and frustration to regulate autonomy
- Bayesian autonomy gradient learning from success/failure history
- Brainstem supervisor for loop detection and zombie process monitoring
- WebGPU-powered Mindscape visualization with 4D coordinate system

**Knowledge Hypergraph** (`packages/knowledge`)
- Content-addressed facts, relations, insights, and patterns
- Active recall reinforcement—nodes strengthen on retrieval
- Memory decay with configurable safety rails
- HAMT/interval/B-tree indices for fast traversal
- Causal reasoning and decision tracking

**Agent Runtime & Execution** (`packages/runtime`, `packages/agent`, `packages/protocol`, `packages/codex`)
- Orchestrates multi-agent "waves" for complex tasks
- Agent Client Protocol (ACP) for standardized client-agent communication
- Codex (Rust) and Droid engines for secure, high-performance execution
- AI SDK v6 streaming with tool chaining and suspend/resume
- Conflict resolution via Arbiter when agents disagree
- Context building from preferences, memory, cognitive state, and learnings

**Local Voice Pipeline** (`packages/voice`)
- Faster-Whisper STT running in persistent Python subprocess pools
- Piper TTS with Maya1 voices for natural speech
- Binary WebSocket transport (no Base64 overhead)
- VAD-driven barge-in for natural interruption
- Real-time Orb visualization with VAD levels

**Local Embeddings** (`packages/embed`)
- KaLM-Embedding-Gemma3-12B via sentence-transformers
- 1024-dimension vectors with MRL truncation
- Process pool for concurrent embedding generation
- Zero external API calls

**Homelab Integration** (`packages/agent`)
- Proxmox VM/container lifecycle management
- Docker container orchestration and log streaming
- Git workflow automation
- Linear issue tracking with agent activities

---

## Cerebras Fast LLM Integration

ALFRED uses **Cerebras** as a first-class inference provider for ultra-fast LLM responses. Cerebras achieves **2,100 tokens/second** for Llama 3.1 70B—16-68x faster than GPU hyperscalers—through 21 PB/s memory bandwidth.

### Why Cerebras?

| Platform | Llama 70B tok/s | TTFT | Best For |
|----------|-----------------|------|----------|
| **Cerebras WSE-3** | 2,100 | 240ms | Throughput, large batches |
| **Groq LPU** | 1,665 | 220ms | Latency consistency |
| **NVIDIA H100** | 50-100 | 1,000-4,200ms | Flexibility, training |

At 2,100 tok/s, Cerebras enables:
- **1,050 tokens in 500ms**: A full reasoning chain completes within voice response latency
- **10x more CoT steps**: Complex multi-step reasoning fits within interactive timeframes
- **Agentic workflows**: Multi-tool sequences execute at conversation speed

### Two-Stage Reasoning for Voice

ALFRED implements a **reasoning preload** pattern: while streaming ASR processes user speech (~200ms), Cerebras speculatively generates reasoning context—pre-computing likely response paths and warming the KV-cache. When the transcript finalizes, a single forward pass verifies and refines the precomputed reasoning, generating the final response with minimal additional latency. This enables **sub-500ms** end-to-end voice response.

### Model Selector

ALFRED's canonical model selector routes requests to the optimal provider by role. Configure `AI_MODEL_CHAT`, `AI_MODEL_PLANNER`, `AI_MODEL_BACKGROUND`, and `AI_MODEL_VOICE` environment variables to route interactive chat, planning, background tasks, and voice to different backends. Both Cerebras and OpenRouter are supported simultaneously—Cerebras for speed, OpenRouter for model diversity.

---

## Cognitive State Machine

The cognitive engine (`packages/cognitive`) implements an event-sourced state machine that governs ALFRED's behavior. The system tracks energy, boredom, and frustration as physiological regulators of autonomy.

### Cognitive States

```
idle → capturing → thinking → deciding → executing → reflecting → idle
```

| State | Purpose | Physiology Effect |
|-------|---------|-------------------|
| **idle** | Awaiting input | Energy recovers |
| **capturing** | Processing user input | Energy decreases slightly |
| **thinking** | Reasoning about options | Energy decreases |
| **deciding** | Evaluating alternatives | Frustration may increase |
| **executing** | Running tools/workflows | Energy decreases |
| **reflecting** | Comparing predicted vs. actual outcome | Frustration decreases on success |

### Physiology System

ALFRED maintains three physiological parameters (0-1 range) that influence behavior:

| Parameter | Effect |
|-----------|--------|
| **Energy** | Decreases with work, affects autonomy level |
| **Boredom** | Increases with repetition, triggers exploration |
| **Frustration** | Increases with errors, reduces autonomy |

**Homeostatic regulation:**
- High frustration → Lower autonomy (more conservative)
- Low energy → Stick to known patterns
- High boredom → Seek novel approaches

### Pure Transitions

All state transitions are **pure functions** with no side effects—they return new state and autonomy, with effects emitted separately at the boundary layer. Budget: Transitions must complete in **<100 µs**. Budget violations are defects.

---

## Personality Hyperparameters (Planned)

ALFRED's persona is tunable through **personality hyperparameters**—numerical values that guide tone, response style, and interaction patterns at runtime. Unlike static prompts, these parameters create a continuous space of personality expression.

### Planned Hyperparameters

| Parameter | Range | Effect |
|-----------|-------|--------|
| **formality** | 0.0-1.0 | Casual ("got it") → Formal ("I shall proceed as requested, Sir") |
| **verbosity** | 0.0-1.0 | Terse single sentences → Detailed explanations with context |
| **initiative** | 0.0-1.0 | Purely reactive → Proactively suggests and anticipates |
| **warmth** | 0.0-1.0 | Clinical, matter-of-fact → Empathetic, encouraging |
| **humor** | 0.0-1.0 | Strictly professional → Dry wit and subtle wordplay |
| **confidence** | 0.0-1.0 | Hedged, uncertain → Decisive, assertive statements |
| **patience** | 0.0-1.0 | Brief, assumes expertise → Thorough, explains prerequisites |

### Runtime Execution Hints

Personality hyperparameters translate to **runtime execution hints** that guide LLM generation without hardcoding specific phrases:

| Hint | Derived From | Effect on Response |
|------|--------------|-------------------|
| **address_style** | formality | "Sir/Madam" vs. first name vs. no address |
| **response_length** | verbosity × task_complexity | Token budget for response |
| **explanation_depth** | patience × user_expertise | How much background to include |
| **certainty_language** | confidence × prediction_accuracy | "I believe" vs. "This will" |
| **proactive_surface** | initiative × context_relevance | Whether to mention related insights |

### Context-Adaptive Tuning

Hyperparameters aren't static—they adapt based on context:

- **Time of day**: Lower formality in evening, higher patience in morning
- **Task type**: Higher confidence for routine operations, lower for novel requests
- **Interaction history**: Adjust patience based on demonstrated user expertise
- **Physiology state**: High frustration increases patience, low energy decreases verbosity
- **Consecutive errors**: Temporarily increase warmth and decrease confidence

### Persona Presets

Quick-start configurations for common use cases:

| Preset | Description | Key Settings |
|--------|-------------|--------------|
| **Alfred Classic** | Traditional butler persona | formality: 0.9, warmth: 0.7, humor: 0.4 |
| **Efficient** | Minimal, action-oriented | formality: 0.3, verbosity: 0.2, initiative: 0.8 |
| **Teacher** | Explanatory, educational | patience: 0.9, verbosity: 0.8, warmth: 0.6 |
| **Peer** | Casual colleague | formality: 0.2, warmth: 0.7, humor: 0.6 |

### Learning Personality Preferences

Over time, ALFRED learns your preferred personality settings:

- **Implicit feedback**: Which response styles you engage with vs. skim
- **Explicit feedback**: Direct "be more concise" / "explain more" corrections
- **Contextual patterns**: Different preferences for different task types
- **Temporal patterns**: How preferences vary by time, energy, and mood

This creates a **personalized personality gradient** that adapts to *you* rather than requiring manual tuning.

---

## Agent Wave Orchestration

For complex tasks, ALFRED decomposes work into subtasks and executes them using **agent waves**—groups of agents that run in parallel with dependency management.

### Wave Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator Input                            │
│         Requirement + Context + Linear Issue (optional)          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                   Phased Planning                              │
│   Decompose → Subtasks → Dependency Graph → Wave Plan          │
└───────────────────────────┬───────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │   Wave 1    │    │   Wave 2    │    │   Wave 3    │
  │  (parallel) │ →  │  (parallel) │ →  │  (parallel) │
  └─────────────┘    └─────────────┘    └─────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌───────────────────────────────────────────────────────────┐
  │                   Merge & Conflict Resolution              │
  │   Arbiter resolves conflicts when agents disagree          │
  └───────────────────────────────────────────────────────────┘
                            │
                            ▼
               ┌─────────────────────┐
               │   Review & Commit   │
               └─────────────────────┘
```

### Execution Phases

1. **Wave Execution**: Agents run in parallel (configurable `ORCHESTRATOR_MAX_PARALLEL`)
2. **Merge Phase**: Combine agent outputs, detect conflicts
3. **Conflict Resolution**: Arbiter agent resolves disagreements
4. **Review Phase**: Self-correction and quality checks

### Agent Types

| Type | Purpose | Tools |
|------|---------|-------|
| **codex** | Code generation and editing | file_write, shell, git |
| **reviewer** | Code review and validation | file_read, lint, test |
| **planner** | Task decomposition | none (reasoning only) |
| **arbiter** | Conflict resolution | none (reasoning only) |

Each wave tracks progress in ExecPlan documents under `.agent/plans/<runId>/`.

---

## Agent Client Protocol (ACP)

ALFRED implements the **Agent Client Protocol (ACP)**, an open standard designed to unify communication between code editors (clients) and AI agents. This allows ALFRED to interact with a wide variety of agents interchangeably while maintaining a consistent security and policy layer.

### Key Benefits
- **Standardization**: Bidirectional JSON-RPC communication between clients (IDEs, CLIs) and agents.
- **Interoperability**: Native support for multiple agents including Claude Code, Codex CLI, Roo, and more.
- **Session Management**: Full lifecycle control with support for session resumption and multi-agent coordination.
- **Secure Handling**: Policy-based tool execution and biometric elevation for high-autonomy operations.

ALFRED Desktop serves as a first-class ACP client, managing sessions and capabilities through a centralized `ACPClientManager`.

---

## Execution Engines (Codex & Droid)

ALFRED leverages specialized execution engines to perform complex tasks with high reliability, performance, and security.

### Codex Agent
The **Codex** agent is ALFRED's primary "thinking" engine. It wraps a high-performance Rust-based CLI (`codex-rs`) to execute code and reason about complex problems.
- **Event-Driven**: Streams structured events (thoughts, commands, artifacts) via NDJSON for real-time observability.
- **Autonomy-Aware**: Maps cognitive autonomy levels directly to sandbox policies (`read-only` vs `workspace-write`).
- **Worktree Isolation**: Executes tasks in isolated Git worktrees to enable parallel agent waves without file contention.

### Droid Agent
The **Droid** agent is a specialized, non-interactive engine designed for deterministic task execution in highly secure or constrained environments.
- **Strict Sandboxing**: Enforces rigid filesystem boundaries and environment allowlists.
- **Secure Spawning**: Uses file descriptor handles and secure CWD logic to protect against TOCTOU (Time-of-check to time-of-use) attacks.
- **Deterministic**: Optimized for reliable tool execution where multi-step interactive reasoning is not required.

---

## Local Voice Pipeline

ALFRED's voice system (`packages/voice`) provides **privacy-preserving speech-to-speech** with authentic speech patterns using local models.

### Voice Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Voice Session                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  WebSocket  │ →  │   STT Pool  │ →  │    LLM      │         │
│  │  (Binary)   │    │ (NeMo 120M) │    │  Reasoning  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         ↑                                    │                   │
│         │                                    ▼                   │
│  ┌─────────────┐                      ┌─────────────┐          │
│  │   Client    │    ←───────────────  │  TTS Pool   │          │
│  │ AudioWorklet│                      │   (Maya1)   │          │
│  └─────────────┘                      └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Models

| Model | Type | Size | Speed | Features |
|-------|------|------|-------|----------|
| **NeMo Parakeet** | STT | 120M | Real-time | End-of-utterance detection |
| **Maya1** | TTS | 3B | <100ms TTFB | Expressive, emotional speech |
| **Supertonic** | TTS | 66M | 167x real-time | Ultra-low latency fallback |
| **Silero VAD** | VAD | 1M | <10ms | Voice activity detection |

### Authentic Speech Patterns

Maya1 generates **expressive, emotional speech** with:
- Natural prosody and intonation
- Authentic accents (configurable)
- Emotional tone matching context
- Breath and pause patterns

### Binary Transport

All audio uses **binary WebSocket frames** (no Base64 overhead):
- Upstream: PCM audio chunks from client microphone
- Downstream: Encoded audio frames to client AudioWorklet
- Control: JSON messages for start/stop/metadata only

### Barge-In Support

VAD-driven interruption allows natural conversation flow:
- Client-side VAD detects user speaking
- Server cancels ongoing TTS playback
- New STT processing begins immediately

---

## Neural Orb & Face Evolution

The **Neural Orb** is ALFRED's visual presence indicator—a morphing, breathing visualization that reflects cognitive state and voice activity.

### Current Implementation

The Orb renders as a WebGL shader with:
- **Black void center**: The "moon" representing ALFRED's core
- **Bioluminescent corona**: Wisps that pulse with audio volume
- **State-driven animation**: idle, listening, thinking, talking, active
- **Volume-reactive**: Corona intensity scales with input volume using smoothstep interpolation

### Cognitive State Mapping

| Cognitive State | Orb State | Visual Effect |
|-----------------|-----------|---------------|
| idle | idle | Slow breathing, dim corona |
| capturing | listening | Pulsing, ears "open" |
| thinking | processing | Faster rotation, denser fibers |
| executing | active | Bright, energetic motion |
| reflecting | processing | Contemplative pulse |

### Physiology Integration

The Cortex engine maps physiology to visual parameters—higher autonomy increases fiber count, higher energy increases rotation speed. The orb becomes a real-time visualization of ALFRED's internal state.

### Planned: Neural Face

The Orb is **planned to evolve into a face**—a more anthropomorphic representation while maintaining the abstract, non-uncanny aesthetic:

- **Expression mapping**: Cognitive state → facial micro-expressions
- **Lip sync**: TTS audio → mouth movement
- **Eye tracking**: Follow user attention
- **Emotional resonance**: Physiology → subtle emotional cues

The face will use procedural animation (not motion capture) to maintain the HUD aesthetic while adding personality.

---

## Terminal UI (TUI)

The TUI (`packages/tui`) provides a **terminal-based interface** for headless operation, SSH access, and power users who prefer keyboard-driven workflows.

### Features

- **Dashboard Mode**: Multi-panel view with cognitive, workflow, metrics, voice, and knowledge panels
- **Chat Mode**: Full conversational interface in the terminal
- **Plan Mode**: View and manage ExecPlan documents
- **Debug Mode**: Real-time system diagnostics

### Launch

Run `bun run alfred tui` for the dashboard, or add a mode suffix (`chat`, `plan`, `debug`) for direct access.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Cycle panel focus |
| `c` | Open chat mode |
| `d` | Open debug mode |
| `p` | Open plan mode |
| `:` | Command palette |
| `q` | Quit |
| `r` | Refresh |

### Architecture

The TUI uses **OpenTUI React** for rendering:

```
┌──────────────────────────────────────────────────────────────┐
│  Cognitive │ Workflow         │ Metrics                      │
│  Panel     │ Panel            │ Panel                        │
│            │                  │                              │
│  State:    │ Active: 2        │ CPU: 45%                     │
│  thinking  │ Pending: 5       │ Memory: 2.1GB                │
│            │                  │ Requests: 142/min            │
├────────────┴──────────────────┴──────────────────────────────┤
│  Voice                        │ Knowledge                    │
│  Panel                        │ Panel                        │
│  Status: idle                 │ Nodes: 12,453                │
│  VAD: ██░░░░░░░░              │ Recent: deploy_config        │
└──────────────────────────────────────────────────────────────┘
```

### Subscriptions

Each panel subscribes to real-time data via tRPC:
- `cognitive.subscribe` → Cognitive state changes
- `workflow.subscribe` → Active workflow events
- `metrics.subscribe` → System metrics
- `voice.status` → Voice session state

---

## Desktop Shell

The web app provides a **fully implemented JARVIS-inspired desktop environment** with layered window management, tiling, and a complete component library. This runs today in the browser via TanStack Start.

**Buntralino wrapper (planned)**: The native desktop app will use **[Buntralino](https://buntralino.github.io/)** to package the existing web UI as a native application—combining Bun's runtime performance with Neutralino.js for native OS browser windows. This eliminates Chrome/Electron bloat while preserving the full desktop shell experience.

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  z:2000  │  Overlay Layer (modals, command palette)             │
├──────────┼──────────────────────────────────────────────────────┤
│  z:1000  │  Menu Bar (top) + Taskbar (bottom)                   │
├──────────┼──────────────────────────────────────────────────────┤
│  z:900   │  Orb Layer (voice presence)                          │
├──────────┼──────────────────────────────────────────────────────┤
│  z:100-500│ Window Layer (tiled/floating windows)               │
├──────────┼──────────────────────────────────────────────────────┤
│  z:50    │  Mindscape Layer (ReactFlow canvas, toggle)          │
├──────────┼──────────────────────────────────────────────────────┤
│  z:0     │  Background (desktop wallpaper)                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### Window Types

| Tier | Windows | Purpose |
|------|---------|---------|
| **Core** | chat, terminal, code, codex, agents | Primary interaction |
| **Operations** | docker, taskmanager, pr-review, agentfs, files | System management |
| **Intelligence** | cortex, learning, policy, tune, plan, metrics, rag | AI/ML introspection |
| **Knowledge** | knowledge, workflow, linear, concept, project | Information management |
| **Productivity** | settings, notes, reminders, todos | Personal tools |

### Window Management

- **DOM-based windowing**: Pure CSS/JS, no canvas dependency
- **Z-index management**: Automatic stacking with focus tracking
- **Keyboard shortcuts**: ⌘K command palette, window navigation
- **Tiling support**: Cascade, tile horizontal/vertical

### Buntralino Native Wrapper (Planned)

The desktop UI components above are **already implemented** and run in any modern browser. Buntralino will package this existing UI as a native application for distribution:

| Benefit | Description |
|---------|-------------|
| **Lighter builds** | Uses native OS browser instead of bundled Chromium (~100MB vs ~500MB) |
| **Full Bun API** | Direct access to filesystem, subprocess spawning, native I/O |
| **Same UI** | Identical desktop shell—no reimplementation needed |
| **Split contexts** | Heavy backend tasks in Bun, UI renders in native browser |
| **Cross-compile** | Single pipeline for Windows, macOS, and Linux builds |

### Design Philosophy

**"Functional JARVIS"** — The aesthetic remains Iron Man HUD-inspired (void black, bioluminescent accents, holographic effects), but every element serves a productive purpose.

---

## Generative UI (Planned)

ALFRED is implementing **generative user interfaces**—allowing the LLM to generate UI components dynamically based on context.

### How It Works

1. User prompts the language model
2. Model decides to call a tool (e.g., `show_weather`)
3. Tool returns structured JSON data
4. Client renders a React component for that tool's output

A registry maps tool names to React components, enabling dynamic UI generation based on tool results.

### Component Manifest

ALFRED maintains a registry of available components:

| Component | Source | Status |
|-----------|--------|--------|
| `orb` | ElevenLabs UI | ✅ Integrated |
| `wave` | ElevenLabs UI | ✅ Integrated |
| `chat` | ElevenLabs UI | ✅ Integrated |
| `code` | AI SDK Elements | 📋 Pending |
| `plan` | AI SDK Elements | 📋 Pending |
| `chart` | Custom | 📋 Pending |

### AI SDK RSC Integration

For advanced use cases, ALFRED will use **AI SDK RSC** to stream React components from the server. This enables truly dynamic interfaces where the AI decides not just *what* to show but *how* to show it—components are generated and streamed in real-time based on context.

---

## Model Finetuning

The `packages/tune` package provides infrastructure for **finetuning models on your interaction history**—enabling ALFRED to become more attuned to your specific patterns.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Finetuning Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Dataset Generation                                          │
│     └─ Export event history → Training JSONL                    │
│                                                                  │
│  2. Training (MLX on Apple Silicon)                             │
│     └─ LoRA adapters for efficient finetuning                   │
│                                                                  │
│  3. Evaluation                                                   │
│     └─ Validate against held-out eval datasets                  │
│                                                                  │
│  4. Deployment                                                   │
│     └─ Fuse adapters into base model                            │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration

Configuration is YAML-based with settings for backend (MLX, PyTorch), model selection, training hyperparameters (epochs, batch size, learning rate), and LoRA adapter parameters (rank, alpha, target modules). See `configs/tune/` for examples.

### What Gets Finetuned

| Data Source | Learning Goal |
|-------------|---------------|
| Chat history | Communication style, preferences |
| Workflow executions | Tool selection patterns |
| Error corrections | Mistake avoidance |
| Knowledge graph | Domain terminology |

### Platform Support

| Platform | Backend | Notes |
|----------|---------|-------|
| **macOS (Apple Silicon)** | MLX | Native, optimized |
| **Linux (AMD)** | PyTorch + ROCm | 4-bit quantization |
| **Linux (NVIDIA)** | PyTorch + CUDA | Full precision available |

---

## Linear Project Management

ALFRED functions as a **first-class Linear agent**, enabling bidirectional integration with your project management workflow.

### Features

- **Issue Assignment**: Assign Linear issues to Alfred like a human teammate
- **Real-time Activities**: See thinking, actions, and results in Linear's activity feed
- **Webhook Integration**: State changes in Linear trigger/cancel ALFRED workflows
- **Project Linking**: Connect ALFRED projects to Linear projects

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Linear Integration Flow                       │
├─────────────────────────────────────────────────────────────────┤
│  1. User assigns issue to Alfred in Linear                       │
│                     ↓                                            │
│  2. Webhook triggers ALFRED workflow                             │
│                     ↓                                            │
│  3. Alfred emits "thought" activity (10s acknowledgment)         │
│                     ↓                                            │
│  4. Workflow executes with "action" activities                   │
│                     ↓                                            │
│  5. Final "response" activity with results + external URL        │
└─────────────────────────────────────────────────────────────────┘
```

### Activity Types

| Type | Purpose | Example |
|------|---------|---------|
| **thought** | Reasoning step | "Analyzing codebase structure..." |
| **action** | Tool execution | "Running `npm test`..." |
| **response** | Final result | "Deployed to preview: https://..." |
| **error** | Failure notification | "Build failed: missing dependency" |

### Configuration

Set Linear OAuth credentials (`LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SECRET`, `LINEAR_REDIRECT_URI`) in your environment to enable the integration.

### Project Vocabulary

ALFRED mirrors Linear's hierarchy:
- **Workspace** → Linear organization
- **Project** → Linear project (long-lived container)
- **Issue** → Linear issue (assigned work)
- **Cycle** → Linear cycle (sprint)

---

## Security Model

### Graduated Autonomy vs. Biometric Authentication

ALFRED implements a **graduated autonomy system** where the autonomy level (0.0-1.0) determines what actions require biometric verification.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Autonomy Level    0.0 ────────────────────────────────── 1.0  │
│                      │         │         │         │         │  │
│   Band:           Read-Only  Suggest  Cautious  Supervised Full │
│                      │         │         │         │         │  │
│   Auth Required:  Session   Session   Elevated  Bio+MFA   Fresh │
│                   Token     Token     Token               Bio   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Autonomy Bands

| Band | Range | What ALFRED Can Do | Authentication |
|------|-------|-------------------|----------------|
| **Read-Only** | 0.0-0.3 | Query, observe, report | Session token |
| **Suggest** | 0.3-0.5 | Propose actions, draft changes | Session token |
| **Cautious** | 0.5-0.7 | Safe mutations with rollback | Elevated token |
| **Supervised** | 0.7-0.9 | Consequential actions with monitoring | Biometric + MFA |
| **Full** | 0.9-1.0 | Unrestricted | Fresh biometric (<2min) |

### Biometric Elevation Flow

High-risk operations trigger **passkey verification**:

```
Workflow reaches high-risk operation
         ↓
Policy engine checks autonomy band
         ↓
Obligation: biometric required
         ↓
Workflow SUSPENDS
         ↓
Client shows passkey prompt
         ↓
User authenticates (Face ID / Touch ID / Security Key)
         ↓
Bio-ticket issued (2-minute TTL)
         ↓
Workflow RESUMES with ticket
```

### Bio-Ticket Properties

- **Short TTL**: 2 minutes by default (prevents hoarding)
- **Scope-bound**: Ticket matches specific operation
- **Replay protection**: Single-use verification
- **Ed25519 signed**: Cryptographic proof

### Policy Configuration

Policy rules are defined in YAML (`config/policy.yaml`), specifying which actions require biometric elevation based on autonomy band and action type. Rules define action patterns, autonomy conditions, and required obligations.

### Adaptive Trust

Autonomy isn't static—it adapts based on outcomes:
- **Success** → Alpha increases (more trust)
- **Failure** → Beta increases (more caution)
- **Override** → Beta increases significantly (learn from correction)
- **Decay** → Returns to baseline over time

---

## Performance & Fast Feedback

ALFRED is **performance-obsessed**—every hot path has strict budgets, and budget violations are treated as defects.

### Performance Budgets

| Operation | Budget | Enforcement |
|-----------|--------|-------------|
| Cognitive state transitions | **<100 µs** | CI fails on breach |
| Graph lookups | **<1 ms** | Prometheus alerts |
| RAG retrieval | **<10 ms** | Prometheus alerts |
| Fact extraction | **<10 ms** | Prometheus alerts |
| Context building | **<100 ms** | Prometheus alerts |
| Plan generation | **<100 ms** | Prometheus alerts |
| UI render cycles | **<16 ms** | 60fps target |
| DB queries (p99) | **<10 ms** | Prometheus alerts |

### Hot Path Optimization

**Zero allocations in hot loops:** Reuse objects instead of spreading or creating new objects on each iteration. Use index-based loops instead of iterators where performance matters.

**Pure functions for transitions:** All cognitive transitions are pure functions that return new state without side effects. Effects are emitted at the boundary layer only.

### Fast Feedback Cycles

ALFRED's development workflow prioritizes **immediate feedback**:

| Feedback Type | Target | Mechanism |
|---------------|--------|-----------|
| Type errors | Instant | `tsc -b --watch` |
| Lint errors | Instant | Biome on save |
| Unit tests | <5s | Bun test (in-memory) |
| Integration tests | <30s | Test containers |
| Full CI | <5min | Parallel jobs |

### CI Budget Enforcement

Run `bun run check:budgets` to verify performance budgets and `bun run test:perf` for the full performance test suite. Budget tests use warmup iterations to ensure stable measurements before timing.

### Metrics Instrumentation

All hot paths emit Prometheus histograms via `@alfred/metrics`. Timers wrap critical operations and automatically record duration, enabling dashboards and alerts for budget violations.

---

## Installation

### Requirements

| Tier | RAM | Storage | Notes |
|------|-----|---------|-------|
| **Cloud Models** | 4GB | 2GB | Uses OpenAI/Anthropic APIs |
| **Local Models** | 16GB+ | 50GB | Includes STT/TTS/embeddings |
| **GPU Acceleration** | 16GB+ | 50GB | ROCm (AMD) or MPS (Apple Silicon) |

### Prerequisites

- [Bun](https://bun.sh) 1.2+
- Docker or Docker Desktop (for PostgreSQL)
- (Optional) [UV](https://github.com/astral-sh/uv) for Python dependencies (voice/embeddings)
- (Optional) Python 3.10+ for local voice and embedding models

### Cloud Models (Quick)

The fastest path to a working ALFRED installation:

```bash
# Clone and install
git clone https://github.com/memaxo/alfred.git
cd alfred
bun install

# Configure environment
cp config/env.example .env
bun scripts/gen-keys.ts >> .env
# Edit .env: set OPENAI_API_KEY

# Start database
bun run db:start    # Launches PostgreSQL with pgvector
bun run db:migrate  # Applies schema migrations

# Launch ALFRED
bun run dev         # Web app at http://localhost:3000
```

### Local Models (Full Privacy)

For complete offline operation with local speech and embeddings:

```bash
# Prerequisites: Python 3.10+, 50GB storage
git clone https://github.com/memaxo/alfred.git
cd alfred
bun install

# Enable Local Voice
cd packages/voice
bun run setup       # Installs Python deps + downloads models

# Enable Local Embeddings
cd ../embed
bun run install-deps
bun run download-model  # Downloads KaLM-Embedding-Gemma3-12B

# Configure for local operation
cd ../..
cp config/env.example .env
bun scripts/gen-keys.ts >> .env
# Edit .env: Set USE_LOCAL_MODELS=true

# Start database and run
bun run db:start
bun run db:migrate
bun run dev
```

### Production Deployment

For homelab or server deployment:

```bash
# Uses Docker Compose for all services
docker compose -f docker-compose.prod.yml up -d
```

→ [Complete deployment guide](docs/deployment/production.md)

---

## Configuration

### Essential Environment Variables

```bash
# Required
DATABASE_URL=postgresql://alfred:alfred@localhost:5432/alfred
OPENAI_API_KEY=sk-...          # Or use local models

# Optional: Local models
USE_LOCAL_MODELS=true
WHISPER_MODEL=large-v3         # STT model
PIPER_VOICE=en_US-amy-medium   # TTS voice

# Optional: Integrations
LINEAR_API_KEY=lin_api_...
GITHUB_TOKEN=ghp_...

# Optional: Proxmox Integration
PROXMOX_HOST=https://proxmox.local:8006
PROXMOX_TOKEN_ID=alfred@pam!alfred
PROXMOX_TOKEN_SECRET=...
```

→ [Full configuration reference](docs/configuration.md)

---

## Self-Hosting

ALFRED is designed for self-hosting on your own infrastructure. See [`docs/architecture/deployment-proxmox.md`](docs/architecture/deployment-proxmox.md) for detailed deployment options.

### Deployment Options

| Method | Best For | Overhead |
|--------|----------|----------|
| **Single Executable** | LXC containers, minimal footprint | Lowest |
| **Docker Compose** | Standard deployments, easy scaling | Low |
| **LXC Container** | Proxmox homelabs, direct resource access | Very Low |
| **Full VM** | Maximum isolation, complex requirements | Medium |

### Single Executable Build

Use Bun's compile target to create a single executable for minimal deployments—minified, bytecode-compiled, and platform-targeted.

### Docker Deployment

Run `docker compose up -d` from `docker/alfred` for containerized deployment.

### Proxmox Integration

ALFRED includes native Proxmox tools for homelab automation:
- VM lifecycle management (create, start, stop, clone, migrate)
- Container operations
- Backup scheduling
- Resource monitoring

---

## Project Structure

```
alfred/
├── apps/
│   ├── web/              # Desktop shell (TanStack Start SSR)
│   └── native/           # iOS app (Expo + React Native)
├── packages/
│   ├── runtime/          # Agent wave orchestration and context building
│   ├── cognitive/        # State machine, physiology, autonomy gradient
│   ├── cortex/           # WebGPU Mindscape and Orb visualization engine
│   ├── knowledge/        # Hypergraph memory with decay and recall
│   ├── learning/         # Self-supervision, pattern extraction
│   ├── plan/             # Phased planning, Linear integration
│   ├── rag/              # Semantic search with pgvector
│   ├── agent/            # AI SDK v6 tool registries (40+ tools)
│   ├── voice/            # Local STT/TTS (Maya1, NeMo) with process pools
│   ├── embed/            # Local embedding model (KaLM, Python subprocess)
│   ├── tune/             # Model finetuning (MLX, LoRA adapters)
│   ├── policy/           # Security engine with biometric elevation
│   ├── db/               # Drizzle schema, migrations, repositories
│   ├── auth/             # Better Auth, passkeys, Ed25519 tokens
│   ├── api/              # tRPC routers, metrics, schedulers
│   ├── type/             # Shared TypeScript contracts
│   ├── ui/               # Shared React components
│   ├── metrics/          # Prometheus registry
│   ├── protocol/         # Agent Client Protocol (ACP) types
│   └── tui/              # Terminal UI (OpenTUI React) for headless operation
├── docs/
│   ├── architecture/     # System design documentation
│   └── execplans/        # Implementation plans and progress
└── config/
    └── env.example       # Environment configuration template
```

---

## API Endpoints

### Streaming (AI SDK v6 SSE)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/assistant` | Assistant tools (notes, reminders, focus) |
| `POST /api/orchestrator` | Orchestrator tools (docker, git, proxmox) |
| `WS /voice/stream` | Binary WebSocket for voice I/O |

### Workflow (tRPC)

| Procedure | Purpose |
|-----------|---------|
| `workflow.start` | Initialize durable workflow run |
| `workflow.stream` | Stream execution events |
| `workflow.resume` | Deliver authorization events |
| `workflow.get` | Hydrate run metadata |

### Health & Metrics

| Endpoint | Purpose |
|----------|---------|
| `/healthz` | Liveness probe |
| `/healthz/deps` | Readiness probe (DB, Redis) |
| `/api/metrics` | Prometheus metrics |

---

## Observability

ALFRED exposes comprehensive Prometheus metrics:

- `trpc_requests_total{procedure,type}` - API request counts
- `workflow_stream_events_total{event}` - Workflow execution
- `cognitive_transitions_total{from,to}` - State machine
- `voice_stt_duration_seconds` - Speech-to-text latency
- `memory_nodes_decayed_total` - Knowledge graph maintenance
- `policy_decisions_total{action,decision}` - Security auditing

---

## iOS App

Native mobile experience with Expo:

- **Library Management**: Notes, Reminders, Bookmarks, Timers
- **Voice Interface**: Neural Orb visualization with Skia
- **Offline Support**: Queue operations when disconnected
- **Push Notifications**: Reminder delivery via APNS
- **Biometric Auth**: Face ID / Touch ID integration

---

## Roadmap

Development is organized into phases tracked in [Linear](https://linear.app/alfred-ops):

### Active Development

| Initiative | Status | Description |
|------------|--------|-------------|
| **AI-Native Workflow System** | 🔨 In Progress | Transform workflows into AI-native orchestration engine |
| **Workflow Pipeline Hardening** | 🔨 In Progress | Reliability improvements and race condition fixes |
| **Cerebras Model Selector** | 🔨 In Progress | Role-based model routing (chat/planner/voice) |
| **Generative UI Framework** | 🔨 In Progress | LLM-generated dynamic React components |

### Planned Phases

| Phase | Focus Area |
|-------|------------|
| **Phase 4** | Preference-Driven Adaptation, Personal Assistant Tools |
| **Phase 5** | Suspend/Resume for Obligations, Tool Chaining |
| **Phase 6** | Management Panes, Settings, Workflow Monitoring |
| **Phase 7** | Mobile Chat Interface |
| **Phase 8** | Load Testing |
| **Phase 9** | Infrastructure & CI/CD |

### Strategic Initiatives

| Initiative | Description |
|------------|-------------|
| **Desktop Evolution** | JARVIS-inspired spatial desktop with tiling window manager |
| **Neural Face** | Evolve Orb into procedural facial expressions with lip sync |
| **Adaptive Cognitive Control** | Self-calibrating Bayesian physiology thresholds |
| **Hypergraph Scalability** | Sub-100ms graph traversal at 10M+ nodes |
| **Hybrid Stack Latency** | Fast-path routing bypassing LLM for simple queries |
| **Two-Stage Voice Reasoning** | Speculative reasoning during STT for sub-500ms response |

→ [View full roadmap in Linear](https://linear.app/alfred-ops/project/alfred-roadmap-f937432f5134)

---

## Development

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Bun 1.3.5+ (execution, package management, bundling) |
| **Language** | TypeScript 5.7+ (strict mode, solution-style projects) |
| **Monorepo** | Turborepo with Bun workspaces and catalogs |
| **Web** | TanStack Start (SSR, file-based routing) |
| **Mobile** | React Native + Expo + NativeWind |
| **API** | tRPC v11 (type-safe RPC with streaming) |
| **Auth** | Better Auth (passkey support, biometric elevation) |
| **Database** | PostgreSQL 16 + pgvector (Drizzle ORM) |
| **AI** | AI SDK v6 (streaming, tools, structured outputs) |
| **Voice** | Faster-Whisper (STT), Piper (TTS), WebRTC VAD |
| **Embeddings** | KaLM-Embedding-Gemma3-12B (local) |
| **Visualization** | WebGPU (Cortex engine), React Three Fiber |
| **Metrics** | Prometheus (observability), structured logging |

### Commands

```bash
bun run dev           # Start all workspaces
bun run build         # Build everything
bun run typecheck     # Solution-style tsc -b
bun run test          # Run all tests
bun run check         # Lint and format (Biome)
bun run db:studio     # Launch Drizzle Studio
```

### Testing

```bash
bun run test:sqlite      # Fast tests with in-memory SQLite
bun run test:postgres    # Full tests against PostgreSQL
bun run test:integration # Integration suites
```

### Naming Conventions

ALFRED follows strict single-word naming for clarity and performance:
- Files: `remind.ts`, `policy.ts`, `graph.ts`
- Directories: `note/`, `voice/`, `cognitive/`
- Domain folders: Group by noun, not verb

See [`.ruler/01-naming-conventions.md`](.ruler/01-naming-conventions.md) for complete guidelines.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/architecture/overview.md`](docs/architecture/overview.md) | System architecture |
| [`docs/architecture/packages.md`](docs/architecture/packages.md) | Package organization |
| [`docs/architecture/learning.md`](docs/architecture/learning.md) | Self-evolution and Bayesian autonomy |
| [`docs/architecture/deployment-proxmox.md`](docs/architecture/deployment-proxmox.md) | Self-hosting guide |
| [`docs/guides/tools.md`](docs/guides/tools.md) | Creating custom tools |
| [`docs/guides/workflows.md`](docs/guides/workflows.md) | Building automated workflows |
| [`docs/guides/linear-integration.md`](docs/guides/linear-integration.md) | Linear project management setup |
| [`docs/guides/security-and-autonomy.md`](docs/guides/security-and-autonomy.md) | Security model and biometric elevation |
| [`docs/guides/performance-optimization.md`](docs/guides/performance-optimization.md) | Performance budgets and hot paths |
| [`docs/research/reasoning-realtime-voice.md`](docs/research/reasoning-realtime-voice.md) | Cerebras voice architecture research |
| [`docs/api/README.md`](docs/api/README.md) | REST and tRPC endpoints |
| [`docs/alfred-prd.md`](docs/alfred-prd.md) | Product requirements |
| [`.ruler/`](.ruler/) | Development conventions |

---

## FAQ

### Why single-user only?

ALFRED is architected for single-user deployment by design. This isn't a limitation—it's intentional. No multi-tenancy overhead means aggressive personalization, direct infrastructure access, and complete data ownership. Every interaction trains a model of *your* preferences.

### Can I use Claude or GPT instead of local models?

Yes. ALFRED supports any OpenAI-compatible API including Anthropic Claude, OpenAI GPT-4, and local models via Ollama. Set your preferred provider in the environment configuration.

### How much does it cost to run?

- **Cloud models**: ~$10-50/month depending on usage (API costs)
- **Local models**: One-time hardware investment; no ongoing API costs
- **Hybrid**: Use local models for routine tasks, cloud for complex reasoning

### What hardware do I need for local models?

- **Minimum**: 16GB RAM, any modern CPU
- **Recommended**: 32GB RAM, Apple Silicon M2+ or AMD GPU with ROCm
- **Storage**: 50GB for models (Whisper, Piper, embeddings)

### Why Cerebras instead of OpenAI?

Cerebras achieves **2,100 tokens/second** for Llama 70B—16-68x faster than GPU inference. This enables sub-500ms voice responses with full reasoning chains. ALFRED uses Cerebras for latency-critical paths (voice, interactive chat) and can fall back to OpenRouter for model diversity. Cost is also compelling: $0.60/M tokens vs. ~$3-10/M on GPU infrastructure.

### Can ALFRED learn my preferences?

Yes. ALFRED implements continuous self-supervision: every interaction updates a Bayesian autonomy prior, patterns are extracted from successful workflows, and the mistake ledger tracks errors for trend analysis. Optionally, you can finetune local models (via `packages/tune`) on your interaction history for even deeper personalization.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection errors | Verify Docker is running: `docker ps` |
| Missing auth keys | Generate: `bun scripts/gen-keys.ts >> .env` |
| Voice not working | Run: `cd packages/voice && bun run setup` |
| Embeddings failing | Run: `cd packages/embed && bun run install-deps && bun run download-model` |
| Migrations failing | Wait for DB to be ready after `db:start`, then retry |

---

## Contributing

ALFRED follows strict development guidelines:

1. **Read the rules**: [`.ruler/`](.ruler/) contains all conventions
2. **Explore first**: Use `rg`, `fd`, `ast-grep` before proposing changes
3. **Match patterns**: Code should feel native to the existing codebase
4. **Test everything**: Unit tests for pure functions, integration tests for boundaries
5. **Update plans**: Significant work uses ExecPlans in `docs/execplans/`

→ [Contributing guide](CONTRIBUTING.md)

---

## License

MIT License © 2025 memaxo

---

<p align="center">
  <sub>Built with 🧠 by a human who wanted an AI that actually learns</sub>
</p>

*"I shall endeavor to ensure your complete satisfaction, Sir."* — ALFRED
