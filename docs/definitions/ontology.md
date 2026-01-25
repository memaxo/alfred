# Ontology

The ontology is ALFRED's structured vocabulary—the concepts, relationships, and categories that give meaning to data and actions. It's the map agents use to navigate capabilities.

## Purpose

Without an ontology, tools are just a flat list. With an ontology:

- Tools are organized by function (knowledge, action, reflection)
- Entities are grouped by domain (note, remind, knowledge)
- Agents can reason about categories rather than memorizing individual tools
- New tools fit into existing categories

The ontology makes ALFRED's capabilities navigable and extensible.

## Tool Categories

| Category        | Purpose                              | Example Tools                                          |
| --------------- | ------------------------------------ | ------------------------------------------------------ |
| **knowledge**   | Query, extract, connect information  | `rag_query`, `knowledge_query`, `knowledge_extract`    |
| **action**      | Perform operations with side effects | `docker_exec`, `git_commit`, `note_create`             |
| **reflection**  | Observe and reason about state       | `cognitive_state`, `learning_pattern`, `memory_recall` |
| **integration** | Interface with external systems      | MCP tools, `web_search`, `ticket_create`, `home`       |
| **system**      | Manage runtime and sessions          | `runtime_status`, `session_create`, `router`           |

Categories answer "what kind of thing is this?" They help agents decide where to look for capabilities.

## Entity Domains

| Domain         | Entities                   | Purpose                      |
| -------------- | -------------------------- | ---------------------------- |
| **note**       | Notes, documents           | User-created text content    |
| **remind**     | Reminders, alerts          | Time-triggered notifications |
| **timer**      | Timers, time tracking      | Duration measurement         |
| **book**       | Library items              | Reading list management      |
| **knowledge**  | Facts, relations, insights | Accumulated understanding    |
| **preference** | Settings, configurations   | User customization           |
| **home**       | Smart devices, entities    | Home automation control      |

Domains answer "what does this relate to?" They group entities by semantic meaning.

## Persistence Layers

| Layer        | Storage                   | Purpose                          |
| ------------ | ------------------------- | -------------------------------- |
| **Artifact** | `.agent/tools/*.json/md`  | Human-readable, agent-consumable |
| **AgentFS**  | SQLite `tool_calls` table | Queryable audit trail            |
| **Postgres** | Relational tables         | Durable entity storage           |

Each layer serves different consumers:

- Agents read artifacts
- Learning systems query AgentFS
- Applications use Postgres

## Encoding

The ontology is encoded in multiple places:

**TypeScript types** (`@alfred/type`)

- `ToolCategory` — Union type of categories
- `ToolAnnotations` — Metadata structure
- `ToolDefinition` — Full tool schema

**Definition files** (`docs/definitions/`)

- Prose explanations of concepts
- Relationships between concepts
- Examples and rationale

**CATALOG.md** (`.agent/tools/CATALOG.md`)

- Generated from annotations
- Tools organized by category
- Read by agents for discovery

**Database schemas** (`packages/db/src/schema/`)

- Entity table definitions
- Relationship constraints

## Evolution

The ontology evolves as ALFRED grows:

1. New entity domains emerge (e.g., adding calendar)
2. New tool categories may be needed (e.g., separating "integration" into "mcp" and "api")
3. Definition files are updated
4. Types are extended
5. CATALOG.md regenerates automatically

Changes to the ontology should be deliberate. Adding a new category fragments existing organization. Adding a new domain requires schema and tool work. Document rationale in definition files.

## Anti-Patterns

**Flat tool lists.** Listing all tools without organization. Agents can't navigate.

**Implicit categories.** Relying on naming conventions instead of explicit annotations. Brittle and unclear.

**Overlapping domains.** Entity that could belong to multiple domains. Forces arbitrary assignment.

**Missing definitions.** Using terms without documenting them. Knowledge silos form.

## Related Concepts

- **tool** — Capabilities organized by the ontology
- **entity** — Data objects grouped into domains
- **artifact** — Persistence layer in the ontology
- **context** — Information types the ontology describes
